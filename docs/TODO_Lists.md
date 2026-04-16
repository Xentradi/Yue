# Roadmap

This roadmap is the execution checklist for the remaining cleanup and product work.
Stability comes first, then command surface cleanup, then docs, then backlog items.

## How To Use This List

1. Work top to bottom.
2. Do not start later phases until the earlier phase is complete.
3. Treat every item as incomplete until the code, docs, and tests all match.
4. When a phase is done, verify it with `npm test` and `npm run lint`.

## Phase 1: Safety And Data Integrity

Goal: make invalid states impossible or obvious before any user-facing cleanup.

### Step 1.1: Audit model and helper behavior

- [x] Review `src/schemas/playerSchema.js`, `src/schemas/lakeSchema.js`, and the economy modules that mutate balances, debt, or stock.
- [x] Identify every path that can create negative balances, missing documents, invalid fields, or stale guild data.
- [x] Confirm the current transaction and update helpers still match the data model.

### Step 1.2: Harden state transitions

- [x] Add validation for negative balances, invalid state transitions, and missing records.
- [x] Make helper methods fail clearly when the requested update cannot be applied.
- [x] Keep cash, bank, debt, and fish stock updates internally consistent.

### Step 1.3: Guard scheduled work

- [x] Verify interest and lake restock jobs only touch the intended guilds and records.
- [x] Add or tighten guards for partial data, deleted members, and missing guild resources.
- [x] Make scheduled task logging precise enough to diagnose failures quickly.

### Step 1.4: Lock in safety tests

- [x] Extend integration coverage for invalid balance changes and missing-document cases.
- [x] Add coverage for scheduled jobs that mutate player or lake state.
- [x] Add regression tests for any state transition that was changed in this phase.

### Phase 1 Done When

- [x] Invalid balance or stock updates are rejected before they corrupt state.
- [x] Scheduled jobs are deterministic and safe on partial data.
- [x] The tests cover the failure modes introduced or fixed here.

## Phase 2: Command Surface And Response Consistency

Goal: make the bot feel like one product instead of a collection of modules.

### Step 2.1: Freeze the canonical command surface

- [x] Compare `src/commands/` against `docs/Command_Surface.md`.
- [x] Decide which commands belong in economy, games, utilities, or admin.
- [x] Remove or re-home leftovers that blur the user mental model.

### Step 2.2: Normalize command names and options

- [x] Keep command names short, stable, and category-appropriate.
- [x] Make option names and descriptions consistent across similar commands.
- [x] Align the slash command definitions with the help text and docs.

### Step 2.3: Standardize help output

- [x] Keep help output grouped by user-recognizable product areas.
- [x] Make sure the help command reflects the canonical command inventory.
- [x] Remove category drift between implementation, docs, and help copy.

### Step 2.4: Normalize response patterns

- [x] Route economy and status responses through `src/utils/economyFeedback.js`.
- [x] Keep embeds, empty states, and confirmation flows aligned across commands.
- [x] Make destructive admin previews explicit before any update is applied.

### Step 2.5: Rework user-facing economy copy

- [x] Keep balance, leaderboard, daily reward, transfer, and loan messaging consistent.
- [x] Use the same nouns and phrasing for the same economic concepts.
- [x] Make failure messages actionable and concise.

### Phase 2 Done When

- [x] Commands are grouped the way users expect them.
- [x] Help output and command definitions match the canonical surface.
- [x] Shared embeds and confirmations are used everywhere they should be.

## Phase 3: Scheduled Jobs And Admin Operations

Goal: make background work and admin actions explicit, safe, and easy to reason about.

### Step 3.1: Verify scheduled maintenance

- [x] Confirm interest calculation, lake restock, and any related scheduled actions are correct.
- [x] Make scheduled task output clear about what ran and what changed.
- [x] Decide whether any scheduled job should become configurable, and document the result. Maintenance cron expressions and lake restock sizes are configurable via environment variables; reminder jobs remain fixed.

### Step 3.2: Harden admin economy actions

- [x] Review airdrops, resets, balance updates, and other destructive admin flows.
- [x] Require explicit previews before changes are applied.
- [x] Keep validation strict for missing targets, invalid amounts, and illegal state changes.

### Step 3.3: Align admin confirmation flows

- [x] Make the confirmation copy explicit about target, field, and amount.
- [x] Keep preview titles and descriptions consistent with the rest of the bot.
- [x] Ensure a cancelled action leaves state unchanged.

### Phase 3 Done When

- Background jobs are traceable and correct.
- Admin operations are guarded, previewed, and consistent.
- Destructive actions cannot proceed without an explicit confirmation path.

## Phase 4: Test Coverage

Goal: turn the current behavior into regression coverage before more cleanup lands.

### Step 4.1: Keep the smoke suite stable

- [x] Maintain startup and command-registration smoke tests.
- [x] Keep the command surface assertion aligned with the canonical command list.
- [x] Make the smoke test fail when a command is added, removed, or renamed without intent.

### Step 4.2: Expand economy integration coverage

- [x] Cover balance, loan, transfer, daily reward, and blackjack flows.
- [x] Cover leaderboards and other read paths that depend on sorting or guild data.
- [x] Add regression cases for any economy helper that changed during earlier phases.

### Step 4.3: Add coverage for scheduled and admin flows

- [x] Add tests for scheduled task behavior and restock paths.
- [x] Add tests for stale-member cleanup and deleted-user handling.
- [x] Add tests for admin confirmation previews and destructive operations.

### Step 4.4: Cover command-surface regressions

- [x] Add tests that fail if help grouping or command registration drifts.
- [x] Add tests for any renamed or re-homed command.
- [x] Keep the tests focused on contract behavior, not implementation details.

### Phase 4 Done When

- [x] The main user journeys are covered.
- [x] Scheduled jobs and admin actions have regression tests.
- [x] Command surface changes cannot slip in unnoticed.

## Phase 5: Documentation

Goal: make the docs reflect the shipped behavior, not the other way around.

### Step 5.1: Sync the primary docs

- [x] Update `README.md` so setup and command references match the current command set.
- [x] Update `docs/Setup_and_Deployment.md` so the operational steps are current.
- [x] Update `docs/Feature_Overview.md` so the implemented systems are accurate.

### Step 5.2: Keep the canonical inventory current

- [x] Keep `docs/Command_Surface.md` as the source of truth for command grouping.
- [x] Keep `docs/Command_Response_Conventions.md` aligned with the shared embed and confirmation helpers.
- [x] Make sure the docs match any command moves or renames from earlier phases.

### Step 5.3: Add operator notes

- [x] Add a short operator note covering deployment, logs, backups, and scheduled jobs.
- [x] Document the current configuration surface in one place.
- [x] Keep the docs short enough that they stay maintainable.

### Phase 5 Done When

- [x] The docs describe the current product accurately.
- [x] The command inventory is documented in one canonical place.
- [x] Operators can run and maintain the bot without guessing.

## Phase 6: Backlog Triage

Goal: separate useful future work from ideas that should stay out of the maintenance pass.

### Step 6.1: Review lower-priority items

- [x] Revisit the P2 items only after the core path is stable.
- [x] Decide whether each P3 item is actually worth implementing.
- [x] Keep P4 ideas out of the active work queue unless the product direction changes.

### Step 6.2: Preserve the backlog boundary

- [x] Keep nonessential ideas off the critical path.
- [x] Move any newly discovered must-fix issues back into Phases 1 to 5.
- [x] Leave a clean separation between maintenance work and future experiments.

### Phase 6 Done When

- [x] The backlog only contains intentional future work.
- [x] Nothing important is stranded in P3 or P4 by mistake.

## Recommended Execution Order

1. Phase 1: Safety and data integrity
2. Phase 2: Command surface and response consistency
3. Phase 3: Scheduled jobs and admin operations
4. Phase 4: Test coverage
5. Phase 5: Documentation
6. Phase 6: Backlog triage

## Priority Guide

- [P0] Must fix before any release or dependency upgrade
- [P1] Should fix during the current maintenance pass
- [P2] Good next step after the core path is stable
- [P3] Backlog
- [P4] Low-priority idea
