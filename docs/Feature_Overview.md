# Feature Overview

## Implemented Systems

- Guild economy with cash, bank, debt, loans, transfers, daily rewards, and leaderboards
- Leveling and message-based XP rewards with role assignment
- Fishing, coin flip, dice, and blackjack mini-games
- Admin tools for balance management, lake restocking, and role syncing
- Scheduled maintenance tasks for interest and lake restocking
- Logging and embeds shared across commands and modules

## Command Surface

- Economy commands are grouped together in help output and cover balance lookup, transfers, daily rewards, and leaderboards
- Game commands stay separate from economy so gambling and fishing flows are easier to scan
- Admin commands are guild-only and require administrator permissions
- The canonical command inventory lives in [Command_Surface.md](./Command_Surface.md)

## Data Model

- `Player` stores economy, progression, and bonus state per user and guild
- `Lake` stores fishing stock per guild

## What Is Not Here

- No dashboard
- No public API
- No persistent web session layer
- No separate service split; this is a single Discord bot process
