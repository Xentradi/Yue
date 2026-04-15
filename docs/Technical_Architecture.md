# Technical Architecture

## Runtime Flow

1. `src/main.js` loads environment variables.
2. Mongoose connects to MongoDB.
3. Discord event handlers and slash commands are registered.
4. The bot logs in and starts processing interactions.

## Bot Structure

- `src/handlers/commandHandler.js` loads slash command modules from `src/commands`
- `src/handlers/eventHandler.js` wires Discord events from `src/events`
- `src/modules/` contains business logic for economy, games, rewards, and scheduled jobs
- `src/models/` and `src/schemas/` define Mongoose persistence
- `src/utils/` contains shared helpers for embeds, logging, calculations, and role management
- Blackjack is a split case: `src/commands/gamble/blackjack.js` is a thin command wrapper and `src/modules/games/blackjackGame.js` contains the game engine and response rendering
- The command inventory and category boundaries are documented in [Command_Surface.md](./Command_Surface.md)

## Request Paths

### Slash Commands

Discord interaction -> `interactionCreate` event -> command lookup -> cooldown check -> command module -> response

Most command modules defer the response and delegate work into a module, then render either `createStatusEmbed` or `createBalanceEmbed` so success and failure states stay visually and textually consistent.

### Message Rewards

Discord message -> `messageCreate` event -> reward module -> player update -> optional level-up role changes

### Scheduled Work

`ready.js` calls `scheduledTasks.registerScheduledTasks()`, which registers cron jobs for interest accrual and lake restocking.

## Data Flow

- Most economy commands read and write `Player` documents keyed by `userId` and `guildId`
- Fishing commands read and write `Lake` documents keyed by `guildId`
- Leaderboards aggregate player data by guild

## Operational Notes

- Cooldowns are stored in memory on the Discord client
- Logging uses Winston with optional Logtail transport
- The bot is designed as a single-process application backed by MongoDB
