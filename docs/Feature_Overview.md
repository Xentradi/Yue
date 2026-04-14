# Feature Overview

## Implemented Systems

- Guild economy with cash, bank, debt, loans, deposits, withdrawals, transfers, and daily rewards
- Leveling and message-based XP rewards with role assignment
- Fishing, coin flip, dice, and blackjack mini-games
- Slash-command leaderboards for cash, bank, debt, and net worth
- Admin tools for balance management, lake restocking, and role syncing
- Scheduled maintenance tasks for interest and lake restocking
- Logging and embeds shared across commands and modules

## Data Model

- `Player` stores economy, progression, and bonus state per user and guild
- `Lake` stores fishing stock per guild

## What Is Not Here

- No dashboard
- No public API
- No persistent web session layer
- No separate service split; this is a single Discord bot process
