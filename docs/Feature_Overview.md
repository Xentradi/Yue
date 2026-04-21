# Feature Overview

## Implemented Systems

- Guild economy with cash, bank, debt, loans, transfers, daily rewards, and leaderboards
- Banking institutions with a reusable service layer and player-scoped active bank preferences
- Bureau-backed loan quotes with bank-specific modifiers and explicit loan contract states
- Loan lifecycle maintenance advances overdue contracts through late, delinquent, foreclosure warning, and foreclosed states, with bank-specific timing and fee policy
- Bank alignment now also changes maintenance tolerance and foreclosure harshness, so righteous, neutral, and demonic institutions do not differ only at quote time
- Active loan repayment now treats the contract ledger as authoritative, while `player.debt` remains the compatibility mirror that gets repaired during loan operations
- The `/loan` command exposes active-bank borrowing, quoting, and repayment flows through the same service layer, and quote output now surfaces the active bank's adjustment to the bureau score
- Leveling and message-based XP rewards with role assignment
- Fishing, coin flip, dice, and blackjack mini-games
- Admin tools for balance management, lake restocking, and role syncing
- Utility commands for help, ping, support links, and user profiles
- Scheduled maintenance tasks for interest, loan lifecycle progression, and lake restocking
- Lakes now persist explicit ownership metadata, and scheduled restocking only targets public lakes for now
- Logging and embeds shared across commands and modules
- The long-term clan/alignment design is tracked separately in [Game_Roadmap.md](./Game_Roadmap.md)

## Command Surface

- Economy commands are grouped together in help output and cover balance lookup, transfers, daily rewards, and leaderboards
- The `/bank` command shows and updates the active bank selection, and autocomplete exposes the known institutions
- Game commands stay separate from economy so gambling and fishing flows are easier to scan
- Utility commands stay separate so support, latency, and profile lookups are easy to find
- Admin commands are guild-only and require administrator permissions
- The canonical command inventory lives in [Command_Surface.md](./Command_Surface.md)

## Data Model

- `Player` stores economy, progression, and bonus state per user and guild
- `Lake` stores fishing stock per guild
- The current `guild` boundary is still transitional for scheduled work and clan-like systems until the roadmap split lands
- The long-term model moves player progression to a global user scope and reserves clan, lake, and bank rules for their own entity types

## What Is Not Here

- No dashboard
- No public API
- No persistent web session layer
- No separate service split; this is a single Discord bot process
