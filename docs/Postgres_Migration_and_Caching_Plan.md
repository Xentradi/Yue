# Postgres Migration and Caching Plan

This document is the implementation blueprint for the live Postgres and Redis data layer used by Yue.

## Goals

- Make Postgres the source of truth.
- Keep Redis as cache, cooldown store, and ephemeral lock/state layer only.
- Preserve current bot behavior while improving correctness and maintainability.
- Treat the migration as a one-time cutover with strong validation and minimal revision risk.

## Constraints And Assumptions

- Orion and Pegasus are in the same VPC, so east-west database latency is already low.
- The current problem is not raw network distance.
- The bot should remain strongly consistent for balances, transfers, loans, claims, and admin mutations.
- Redis should not become authoritative storage.
- The migration should be validated end-to-end before cutover.

## High-Level Design

### Source Of Truth

- Postgres stores all persistent bot state.
- No legacy datastore is part of the runtime path.

### Cache And Ephemeral State

- Redis stores:
  - cooldown keys
  - leaderboard snapshots
  - hot read caches where profiling shows real benefit
  - temporary locks and idempotency guards
- Redis does not store primary balance or lake state.

### Data Access Layer

- Use a thin repository layer over `pg`.
- Keep SQL explicit and versioned in migration files.
- Avoid introducing a large ORM unless later implementation pressure proves it necessary.

## Current Persistent Surfaces

### Player Economy

- `balance`
- `daily`
- `deposit`
- `withdraw`
- `pay`
- `steal`
- `leaderboard`
- admin `economy get`
- admin `economy set`
- admin `economy give`
- admin `economy reset`
- admin `economy airdrop`
- `messageReward`
- loan helpers
- bank interest job
- blackjack odds check

### Lake And Fishing

- `fish`
- `restocklake`
- fishing admin restock helper

### Scheduled Work

- daily maintenance
- hourly maintenance
- guild tracking for scheduled jobs

### Ephemeral State

- command cooldowns
- temporary command interaction state
- leaderboard snapshots

## Proposed Postgres Schema

### `players`

Canonical player state.

Columns:

- `id` bigint or UUID primary key
- `guild_id` text not null
- `user_id` text not null
- `exp` integer not null default 0
- `level` integer not null default 0
- `cash` bigint not null default 0
- `bank` bigint not null default 0
- `debt` bigint not null default 0
- `reputation` integer not null default 0
- `relationship` integer not null default 0
- `exp_multiplier` numeric not null default 1
- `cash_multiplier` numeric not null default 1
- `interest_multiplier` numeric not null default 1
- `last_daily_bonus_claim` timestamptz null
- `stats` jsonb not null default '{}'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- `net_worth` generated stored as `cash + bank - debt`

Constraints:

- unique `(guild_id, user_id)`
- check `cash >= 0`
- check `bank >= 0`
- check `debt >= 0`

Indexes:

- `(guild_id, user_id)`
- `(guild_id, cash desc)`
- `(guild_id, bank desc)`
- `(guild_id, debt desc)`
- `(guild_id, net_worth desc)`

### `lakes`

One lake per guild.

Columns:

- `id` bigint or UUID primary key
- `guild_id` text not null unique
- `last_stocked` timestamptz null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### `lake_fish_stock`

Per-lake fish inventory.

Columns:

- `lake_id` foreign key to `lakes.id`
- `fish_type` text not null
- `count` integer not null
- `reward` integer not null

Constraints:

- unique `(lake_id, fish_type)`
- check `count >= 0`

### `economy_ledger`

Audit and idempotency table.

Columns:

- `id` bigint or UUID primary key
- `guild_id` text not null
- `actor_user_id` text null
- `target_user_id` text null
- `event_type` text not null
- `delta_cash` bigint not null default 0
- `delta_bank` bigint not null default 0
- `delta_debt` bigint not null default 0
- `dedupe_key` text not null unique
- `metadata` jsonb not null default '{}'
- `created_at` timestamptz not null default now()

## Redis Key Plan

Use versioned keys. Do not rely on wildcard deletes.

### Cache Keys

- `player_cache:{guild_id}:{user_id}:v{version}`
- `leaderboard:{guild_id}:{metric}:v{version}`
- `tracked_guilds:v{version}`
- `lake_cache:{guild_id}:v{version}`

### Ephemeral Keys

- `cooldown:{command}:{guild_id}:{user_id}`
- `lock:{action}:{interaction_id}`
- optional idempotency key mirrors if needed for retries

### Invalidation Strategy

- Any player mutation increments the guild player cache version.
- Any leaderboard-relevant mutation increments the guild leaderboard cache version.
- Any lake mutation increments the guild lake cache version.
- Scheduled jobs should bump cache versions after bulk updates.

## Command And Job Mapping

### `balance`

- Read one player row.
- Keep the path simple.
- Add an optional short TTL cache only if repeated reads justify it.

### `daily`

- Use one transaction.
- Check `last_daily_bonus_claim`.
- Write the cash update and the claim timestamp together.
- Record one ledger row with a dedupe key like `daily:{guild_id}:{user_id}:{date}`.

### `deposit` / `withdraw`

- Use one transaction.
- Update cash and bank atomically.
- Return the updated row with `RETURNING`.
- Avoid read-modify-save loops.

### `pay`

- Lock both player rows in a stable order.
- Update sender and recipient in one transaction.
- Record a ledger entry.
- Return both updated balances only if needed for the response.

### `steal`

- Lock both rows in a stable order.
- Apply success or penalty in one transaction.
- Write a ledger entry with the steal outcome.
- Keep rollback logic inside the transaction, not in application-level retry code.

### `leaderboard`

- Query by `cash`, `bank`, `debt`, or `net_worth`.
- Use indexes on the sort column.
- Cache top-N results in Redis.
- Invalidate on any mutation that changes a relevant balance.

### Admin `economy get`

- Simple player read.
- Cacheable but not required.

### Admin `economy set` / `give` / `reset`

- Use one transaction.
- Update the target player row.
- Write a ledger entry with actor, target, field, and amount.
- Invalidate player and leaderboard caches for that guild.

### Admin `economy airdrop`

- Read active members from the interaction context.
- Bulk update qualifying player rows.
- Consider one ledger row per recipient if auditability matters more than compactness.
- Invalidate guild caches once after the batch completes.

### `messageReward`

- Use one atomic upsert/update path.
- If the player does not exist, create them in the same transaction.
- Consider a dedupe key based on `message_id` if the message pipeline can retry.
- Do not cache the authoritative state here.

### `fish`

- Lock the lake row and the player row.
- Choose the fish from the lake stock.
- Update fish counts and player balances in one transaction.
- Write a ledger entry.

### `restocklake`

- Replace lake stock transactionally.
- Update `last_stocked`.
- Invalidate lake cache.

### Scheduled Maintenance

- Replace `distinct` scans and per-document updates with set-based SQL where possible.
- Keep bank interest maintenance player-wide and batched.
- Keep lake restock maintenance focused on public lake records and batched.
- Use cached public-lake lookup only where it prevents unnecessary work; do not make the scheduler depend on guild tracking.

### `blackjack`

- Use the generated `net_worth` column for the ranking/odds check.
- Keep odds computation simple and indexed.
- Do not cache fairness-sensitive logic aggressively.

## Migration Phases

### Phase 1: Schema And Access Layer

- Create Postgres schema migrations.
- Add repositories for players, lakes, lake stock, and ledger.
- Wire in `pg` connection management.
- Add a lightweight query helper and transaction wrapper.

### Phase 2: Dual Test Coverage In Local Dev Only

- Port integration tests to Postgres.
- Keep the test surface equivalent to the current behavior.
- Verify command outputs and error paths.

### Phase 3: Backfill

- Export current legacy data.
- Load into Postgres.
- Validate counts, totals, and representative samples.

### Phase 4: Redis Layer

- Add Redis client and cache helpers.
- Implement versioned cache keys.
- Add invalidation hooks for player, leaderboard, and lake mutations.

### Phase 5: Shadow Validation

- Run Postgres-backed tests and compare key outputs against legacy fixtures if needed.
- Confirm leaderboard order, daily claim behavior, transfer behavior, and scheduled updates.

### Phase 6: Cutover

- Freeze writes.
- Perform a final delta export from the legacy store, if any remains.
- Import delta into Postgres.
- Flip the bot to Postgres + Redis.
- Keep the legacy store read-only until stabilization passes.

### Phase 7: Cleanup

- Remove any legacy datastore runtime dependencies.
- Remove migration-only compatibility code.
- Keep the ledger and repository layers.

## Validation Gates

### Functional Gates

- `balance` must match current behavior.
- `daily` must only award once per day.
- `deposit` and `withdraw` must preserve balance totals.
- `pay` and `steal` must be atomic and rollback-safe.
- `leaderboard` must preserve ordering and member resolution behavior.
- `fish` must preserve lake counts and player balances.
- `restocklake` must produce the expected stock distribution.
- `messageReward` must not double-award on retries if idempotency is enabled.

### Data Gates

- No negative balances.
- No missing player rows for existing guild members after backfill.
- No missing lake or fish stock rows after import.
- Ledger totals must reconcile against player totals for sampled guilds.

### Performance Gates

- Hot reads should be one query or a Redis hit.
- Money movement commands should be one transaction.
- Bulk maintenance should be set-based, not per-document save loops.

## Rollback Plan

- If validation fails before cutover, discard the import and fix the migration.
- If cutover fails immediately after flip, point the bot back at the legacy store and leave Redis disabled or read-only.
- Keep the legacy store available read-only until the first post-cutover verification window completes.

## Notes On Redis

Redis is worth adding only if it is used narrowly and intentionally.

Good Redis uses:

- cooldowns
- leaderboard snapshots
- hot read caches with TTL
- ephemeral locks

Bad Redis uses:

- source of truth for balances
- source of truth for lakes
- long-lived economic state that must survive restarts without a second durable store

## Implementation Rule

Do not start coding until the schema, transactions, cache keys, and invalidation rules are all written down and reviewed.
