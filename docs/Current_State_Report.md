# Current State Report

Date: 2026-04-21

## Executive Summary

Yue is currently a working Discord bot built around a guild economy, loan system, mini-games, leveling, and admin utilities. The codebase has been refactored onto PostgreSQL and Redis, command handling is thin and module-driven, and the maintenance roadmap in `docs/TODO_Lists.md` is complete. The remaining product direction lives in `docs/Game_Roadmap.md`, which is still a design document for future clan and world systems rather than an implementation checklist.

The configured PostgreSQL database is the live database, but it is currently being used as the testing database for this project. That means the runtime is operational, but database changes should still be treated carefully because they affect the same instance used for validation.

## What The Bot Does Today

### Economy

- Tracks cash, bank, debt, loans, transfers, daily rewards, and leaderboards.
- Supports `/bank` for viewing and changing the active bank preference.
- Supports `/loan` for quotes, borrowing, and repayment through the same service layer.
- Applies daily bank interest and loan lifecycle maintenance through scheduled jobs.
- Uses bank-specific policy modifiers so institutions can behave differently during approval and maintenance.

### Games

- Includes blackjack, coin flip, dice, and fishing.
- Blackjack is split into a thin command wrapper plus a dedicated game engine module.
- Fishing reads and writes lake records and uses the shared lake persistence layer.

### Progression And Utilities

- Message rewards and leveling are implemented.
- Utility commands cover help, ping, support, and user lookup.
- Admin tools cover economy adjustments, lake restocking, and role synchronization.

### Scheduled Work

- Scheduled maintenance runs from the Discord bot process.
- Daily maintenance now applies bank interest across player accounts and restocks public lakes directly.
- Hourly maintenance restocks public lakes only.
- Loan lifecycle maintenance advances overdue loans through late, delinquent, foreclosure warning, foreclosed, and closed states.

## Current Architecture

### Runtime

1. Environment variables are loaded.
2. PostgreSQL schema is ensured.
3. Redis is initialized if configured.
4. Discord event handlers and slash commands are registered.
5. The bot logs in and starts handling interactions.

### Data Layer

- `src/models/Player.js` and `src/models/Lake.js` are the primary domain models.
- `src/storage/` contains the repository and cache helpers for Postgres-backed state.
- `src/modules/economy/` contains reusable service logic for bank, credit, loans, transfers, and maintenance.
- `src/modules/games/` contains the game engines and lake restock logic.

### Command Layer

- Slash commands are thin adapters.
- Response formatting is centralized through shared embed helpers.
- Guild-only commands reject direct messages with consistent feedback.
- Destructive admin actions use confirmation previews before changes are applied.

## Data Model State

### Player

- Player economy state is still keyed by `userId` and `guildId`.
- A player row carries cash, bank, debt, progression, and bonus state.
- Loan debt is now treated as a compatibility mirror for the contract ledger.

### Lake

- Lake state is stored per guild ID, but ownership is explicit.
- Lakes now carry ownership metadata such as public or clan.
- Public lake restocks target public lake records instead of treating every player-bearing guild as a lake target.

### Loans And Credit

- Loan contracts are stored explicitly in a dedicated contract table.
- The credit profile system tracks bureau score and related modifiers.
- Active bank selection is stored per user.

## Completed Roadmap State

The execution roadmap in `docs/TODO_Lists.md` is fully complete.

That includes:

- startup safety and restart readiness
- data integrity hardening
- command surface cleanup and response consistency
- scheduled job and admin flow hardening
- test coverage expansion
- documentation synchronization
- backlog triage
- profiling and layering work

Validation was run successfully with:

- `npm test`
- `npm run lint`

## Remaining Product Roadmap

The long-term game roadmap in `docs/Game_Roadmap.md` still contains future design work. It is not yet implemented end to end.

Still outstanding there:

- global player model and explicit clan membership
- alignment and virtue thresholds
- public vs clan resource behavior
- broader banking institution behavior and approval rules
- full lake-scoped and clan-scoped world behavior
- travel, visit, and hostility systems

In other words, the maintenance and architecture cleanup is done, but the deeper clan/world gameplay model is still ahead.

## Operational Notes

- The bot expects `DISCORD_TOKEN` and `DB_URL` at startup.
- `DEPLOY_COMMANDS_ON_STARTUP=0` can be used for test-only restarts that should skip command deployment.
- `PROFILE_PERFORMANCE=1`, `PROFILE_COMMANDS=1`, `PROFILE_DB=1`, and `PROFILE_CACHE=1` control runtime telemetry.
- Because the configured Postgres database is the live one, tests and manual writes should be treated as production-impacting even when the intent is validation.

## Practical Assessment

Yue is currently in a stable, working maintenance state:

- the current command inventory is coherent
- the economy stack is modular and test-covered
- scheduler behavior matches the current entity model
- profiling is available for the hot paths
- documentation matches the shipped behavior

The main thing left is product expansion from the current bot into the full clan/world design described in `docs/Game_Roadmap.md`.
