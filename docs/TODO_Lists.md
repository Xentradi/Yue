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

- [ ] Review `src/schemas/playerSchema.js`, `src/schemas/lakeSchema.js`, and the economy modules that mutate balances, debt, or stock.
- [ ] Identify every path that can create negative balances, missing documents, invalid fields, or stale guild data.
- [ ] Confirm the current transaction and update helpers still match the data model.

### Step 1.2: Harden state transitions

- [ ] Add validation for negative balances, invalid state transitions, and missing records.
- [ ] Make helper methods fail clearly when the requested update cannot be applied.
- [ ] Keep cash, bank, debt, and fish stock updates internally consistent.

### Step 1.3: Guard scheduled work

- [ ] Verify interest and lake restock jobs only touch the intended guilds and records.
- [ ] Add or tighten guards for partial data, deleted members, and missing guild resources.
- [ ] Make scheduled task logging precise enough to diagnose failures quickly.

### Step 1.4: Lock in safety tests

- [ ] Extend integration coverage for invalid balance changes and missing-document cases.
- [ ] Add coverage for scheduled jobs that mutate player or lake state.
- [ ] Add regression tests for any state transition that was changed in this phase.

### Phase 1 Done When

- Invalid balance or stock updates are rejected before they corrupt state.
- Scheduled jobs are deterministic and safe on partial data.
- The tests cover the failure modes introduced or fixed here.

## Phase 2: Command Surface And Response Consistency

Goal: make the bot feel like one product instead of a collection of modules.

### Step 2.1: Freeze the canonical command surface

- [ ] Compare `src/commands/` against `docs/Command_Surface.md`.
- [ ] Decide which commands belong in economy, games, utilities, or admin.
- [ ] Remove or re-home leftovers that blur the user mental model.

### Step 2.2: Normalize command names and options

- [ ] Keep command names short, stable, and category-appropriate.
- [ ] Make option names and descriptions consistent across similar commands.
- [ ] Align the slash command definitions with the help text and docs.

### Step 2.3: Standardize help output

- [ ] Keep help output grouped by user-recognizable product areas.
- [ ] Make sure the help command reflects the canonical command inventory.
- [ ] Remove category drift between implementation, docs, and help copy.

### Step 2.4: Normalize response patterns

- [ ] Route economy and status responses through `src/utils/economyFeedback.js`.
- [ ] Keep embeds, empty states, and confirmation flows aligned across commands.
- [ ] Make destructive admin previews explicit before any update is applied.

### Step 2.5: Rework user-facing economy copy

- [ ] Keep balance, leaderboard, daily reward, transfer, and loan messaging consistent.
- [ ] Use the same nouns and phrasing for the same economic concepts.
- [ ] Make failure messages actionable and concise.

### Phase 2 Done When

- Commands are grouped the way users expect them.
- Help output and command definitions match the canonical surface.
- Shared embeds and confirmations are used everywhere they should be.

## Phase 3: Scheduled Jobs And Admin Operations

Goal: make background work and admin actions explicit, safe, and easy to reason about.

### Step 3.1: Verify scheduled maintenance

- [ ] Confirm interest calculation, lake restock, and any related scheduled actions are correct.
- [ ] Make scheduled task output clear about what ran and what changed.
- [ ] Decide whether any scheduled job should become configurable, and document the result.

### Step 3.2: Harden admin economy actions

- [ ] Review airdrops, resets, balance updates, and other destructive admin flows.
- [ ] Require explicit previews before changes are applied.
- [ ] Keep validation strict for missing targets, invalid amounts, and illegal state changes.

### Step 3.3: Align admin confirmation flows

- [ ] Make the confirmation copy explicit about target, field, and amount.
- [ ] Keep preview titles and descriptions consistent with the rest of the bot.
- [ ] Ensure a cancelled action leaves state unchanged.

### Phase 3 Done When

- Background jobs are traceable and correct.
- Admin operations are guarded, previewed, and consistent.
- Destructive actions cannot proceed without an explicit confirmation path.

## Phase 4: Test Coverage

Goal: turn the current behavior into regression coverage before more cleanup lands.

### Step 4.1: Keep the smoke suite stable

- [ ] Maintain startup and command-registration smoke tests.
- [ ] Keep the command surface assertion aligned with the canonical command list.
- [ ] Make the smoke test fail when a command is added, removed, or renamed without intent.

### Step 4.2: Expand economy integration coverage

- [ ] Cover balance, loan, transfer, daily reward, and blackjack flows.
- [ ] Cover leaderboards and other read paths that depend on sorting or guild data.
- [ ] Add regression cases for any economy helper that changed during earlier phases.

### Step 4.3: Add coverage for scheduled and admin flows

- [ ] Add tests for scheduled task behavior and restock paths.
- [ ] Add tests for stale-member cleanup and deleted-user handling.
- [ ] Add tests for admin confirmation previews and destructive operations.

### Step 4.4: Cover command-surface regressions

- [ ] Add tests that fail if help grouping or command registration drifts.
- [ ] Add tests for any renamed or re-homed command.
- [ ] Keep the tests focused on contract behavior, not implementation details.

### Phase 4 Done When

- The main user journeys are covered.
- Scheduled jobs and admin actions have regression tests.
- Command surface changes cannot slip in unnoticed.

## Phase 5: Documentation

Goal: make the docs reflect the shipped behavior, not the other way around.

### Step 5.1: Sync the primary docs

- [ ] Update `README.md` so setup and command references match the current command set.
- [ ] Update `docs/Setup_and_Deployment.md` so the operational steps are current.
- [ ] Update `docs/Feature_Overview.md` so the implemented systems are accurate.

### Step 5.2: Keep the canonical inventory current

- [ ] Keep `docs/Command_Surface.md` as the source of truth for command grouping.
- [ ] Keep `docs/Command_Response_Conventions.md` aligned with the shared embed and confirmation helpers.
- [ ] Make sure the docs match any command moves or renames from earlier phases.

### Step 5.3: Add operator notes

- [ ] Add a short operator note covering deployment, logs, backups, and scheduled jobs.
- [ ] Document the current configuration surface in one place.
- [ ] Keep the docs short enough that they stay maintainable.

### Phase 5 Done When

- The docs describe the current product accurately.
- The command inventory is documented in one canonical place.
- Operators can run and maintain the bot without guessing.

## Phase 6: Backlog Triage

Goal: separate useful future work from ideas that should stay out of the maintenance pass.

### Step 6.1: Review lower-priority items

- [ ] Revisit the P2 items only after the core path is stable.
- [ ] Decide whether each P3 item is actually worth implementing.
- [ ] Keep P4 ideas out of the active work queue unless the product direction changes.

### Step 6.2: Preserve the backlog boundary

- [ ] Keep nonessential ideas off the critical path.
- [ ] Move any newly discovered must-fix issues back into Phases 1 to 5.
- [ ] Leave a clean separation between maintenance work and future experiments.

### Phase 6 Done When

- The backlog only contains intentional future work.
- Nothing important is stranded in P3 or P4 by mistake.

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
