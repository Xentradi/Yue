# Database Interactions, Atomicity, and Cache Plan

This document inventories the runtime database touchpoints in Yue and defines the rules for atomicity, transaction safety, and Redis usage.

## Scope

- Postgres is the durable source of truth.
- Redis is a non-authoritative cache and ephemeral coordination layer.
- The bot runs as a single process with a shared `pg` pool and a shared Redis client.

## Runtime Database Interactions

### Player Reads

- [src/modules/economy/playerInfo/balance.js](/Users/xen/projects/Yue/src/modules/economy/playerInfo/balance.js)
- [src/modules/economy/bonuses/dailyBonus.js](/Users/xen/projects/Yue/src/modules/economy/bonuses/dailyBonus.js)
- [src/modules/economy/bankOperations/deposit.js](/Users/xen/projects/Yue/src/modules/economy/bankOperations/deposit.js)
- [src/modules/economy/bankOperations/withdraw.js](/Users/xen/projects/Yue/src/modules/economy/bankOperations/withdraw.js)
- [src/modules/economy/transfers/giveCash.js](/Users/xen/projects/Yue/src/modules/economy/transfers/giveCash.js)
- [src/modules/economy/transfers/stealCash.js](/Users/xen/projects/Yue/src/modules/economy/transfers/stealCash.js)
- [src/modules/economy/leaderboards/cashLeaderboard.js](/Users/xen/projects/Yue/src/modules/economy/leaderboards/cashLeaderboard.js)
- [src/modules/economy/leaderboards/bankLeaderboard.js](/Users/xen/projects/Yue/src/modules/economy/leaderboards/bankLeaderboard.js)
- [src/modules/economy/leaderboards/debtLeaderboard.js](/Users/xen/projects/Yue/src/modules/economy/leaderboards/debtLeaderboard.js)
- [src/modules/economy/leaderboards/netWorthLeaderboard.js](/Users/xen/projects/Yue/src/modules/economy/leaderboards/netWorthLeaderboard.js)
- [src/modules/economy/bankOperations/interest.js](/Users/xen/projects/Yue/src/modules/economy/bankOperations/interest.js)
- [src/modules/economy/adminOperations/getBalance.js](/Users/xen/projects/Yue/src/modules/economy/adminOperations/getBalance.js)
- [src/commands/admin/syncRoles.js](/Users/xen/projects/Yue/src/commands/admin/syncRoles.js)
- [src/modules/games/blackjackGame.js](/Users/xen/projects/Yue/src/modules/games/blackjackGame.js)
- [src/modules/messageReward.js](/Users/xen/projects/Yue/src/modules/messageReward.js)
- [src/modules/scheduledEvents/scheduledTasks.js](/Users/xen/projects/Yue/src/modules/scheduledEvents/scheduledTasks.js)

### Player Writes

- [src/modules/economy/bonuses/dailyBonus.js](/Users/xen/projects/Yue/src/modules/economy/bonuses/dailyBonus.js)
- [src/modules/economy/bankOperations/deposit.js](/Users/xen/projects/Yue/src/modules/economy/bankOperations/deposit.js)
- [src/modules/economy/bankOperations/withdraw.js](/Users/xen/projects/Yue/src/modules/economy/bankOperations/withdraw.js)
- [src/modules/economy/transfers/giveCash.js](/Users/xen/projects/Yue/src/modules/economy/transfers/giveCash.js)
- [src/modules/economy/transfers/stealCash.js](/Users/xen/projects/Yue/src/modules/economy/transfers/stealCash.js)
- [src/modules/economy/loans/takeLoan.js](/Users/xen/projects/Yue/src/modules/economy/loans/takeLoan.js)
- [src/modules/economy/loans/repayLoan.js](/Users/xen/projects/Yue/src/modules/economy/loans/repayLoan.js)
- [src/modules/economy/adminOperations/setBalance.js](/Users/xen/projects/Yue/src/modules/economy/adminOperations/setBalance.js)
- [src/modules/economy/adminOperations/giveBalance.js](/Users/xen/projects/Yue/src/modules/economy/adminOperations/giveBalance.js)
- [src/modules/economy/adminOperations/resetBalance.js](/Users/xen/projects/Yue/src/modules/economy/adminOperations/resetBalance.js)
- [src/modules/economy/adminOperations/airdrop.js](/Users/xen/projects/Yue/src/modules/economy/adminOperations/airdrop.js)
- [src/modules/economy/bankOperations/interest.js](/Users/xen/projects/Yue/src/modules/economy/bankOperations/interest.js)
- [src/modules/messageReward.js](/Users/xen/projects/Yue/src/modules/messageReward.js)
- [src/modules/economy/balance.js](/Users/xen/projects/Yue/src/modules/economy/balance.js)

### Lake Reads And Writes

- [src/modules/games/fishing.js](/Users/xen/projects/Yue/src/modules/games/fishing.js)
- [src/modules/games/adminOperations/restockLake.js](/Users/xen/projects/Yue/src/modules/games/adminOperations/restockLake.js)
- [src/commands/admin/restockLake.js](/Users/xen/projects/Yue/src/commands/admin/restockLake.js)
- [src/modules/scheduledEvents/scheduledTasks.js](/Users/xen/projects/Yue/src/modules/scheduledEvents/scheduledTasks.js)

### Shared Infrastructure

- [src/storage/postgres.js](/Users/xen/projects/Yue/src/storage/postgres.js)
- [src/storage/cache.js](/Users/xen/projects/Yue/src/storage/cache.js)
- [src/models/Player.js](/Users/xen/projects/Yue/src/models/Player.js)
- [src/models/Lake.js](/Users/xen/projects/Yue/src/models/Lake.js)

## Atomicity Rules

### Single-row reads

- Use `SELECT` with narrow projections.
- Cache only if the same guild/user pair is read repeatedly.
- Keep cache TTLs short enough that invalidation is a performance optimization, not a correctness requirement.

### Single-row writes

- Use `UPDATE ... RETURNING`.
- Avoid load-modify-save loops.
- Prefer one round-trip over separate read and write calls.

### Multi-row money movement

- Wrap the whole operation in a transaction.
- Lock rows in a stable order to avoid deadlocks.
- Update both rows in the same transaction.
- Return only after commit succeeds.

### Lake mutation

- Treat lake stock and lake metadata as one unit.
- Update the lake row and fish stock rows in the same transaction.
- Do not let fishing mutate cash if the lake update fails.

### Bulk scheduled work

- Prefer set-based SQL over per-player loops.
- If a bulk job must loop, keep the loop inside a transaction batch where practical.
- After bulk updates, bump the relevant Redis version key once rather than deleting keys individually.

### Idempotency and retries

- For retriable or externally triggered commands, use a dedupe key in `economy_ledger` before applying the effect.
- If a retry could double-award or double-charge, transaction boundaries are not enough on their own.

## Redis Cache Plan

### Versioned keys

- `player_cache:{guild_id}:{user_id}:v{version}`
- `leaderboard:{guild_id}:{metric}:v{version}`
- `tracked_guilds:v{version}`
- `lake_cache:{guild_id}:v{version}`

### TTL guidance

- Player profile cache: 30 to 120 seconds.
- Leaderboards: 30 to 300 seconds depending on command frequency.
- Guild tracking and lake cache: short TTL plus version invalidation.
- Cooldowns and locks: short TTL only.

### Invalidation rules

- Any player balance mutation bumps the guild player version.
- Any leaderboard-affecting mutation bumps the guild leaderboard version.
- Any lake update bumps the guild lake version.
- Scheduled jobs bump versions after they finish their batch.

### Network efficiency

- Cache only hot reads, not authoritative state.
- Use `RETURNING` to avoid re-fetching rows after writes.
- Keep `SELECT` projections narrow and avoid `SELECT *` in command paths.
- Reuse the pooled Postgres client and transaction client instead of opening new connections in inner loops.

## Operational Plan

### Safe write patterns already in place

- `daily`
- `deposit`
- `withdraw`
- `pay`
- `steal`
- `takeLoan`
- `repayLoan`
- `setBalance`
- `giveBalance`
- `resetBalance`
- `airdrop`
- `restockLake`
- `messageReward`

### Follow-up hardening targets

- Move `messageReward` to a deduped upsert if message retries become possible.
- Convert `interest` into a set-based bulk update.
- Convert any remaining full-table scans into indexed or cached reads where possible.
- Add ledger writes to high-value mutations if auditability becomes a requirement.

### Review checklist before new DB work lands

- Does the mutation touch more than one row?
- If yes, is it wrapped in one transaction?
- Does the code depend on read-after-write consistency?
- If yes, can the write use `RETURNING` instead of a second read?
- Is the read repeated often enough to cache?
- If yes, is the cache versioned and invalidated after commit?
- Does the change add a new hot path query?
- If yes, is there an index for the filter and sort order?
