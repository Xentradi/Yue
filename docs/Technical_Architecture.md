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

## Request Paths

### Slash Commands

Discord interaction -> `interactionCreate` event -> command lookup -> cooldown check -> command module -> response

### Message Rewards

Discord message -> `messageCreate` event -> reward module -> player update -> optional level-up role changes

### Scheduled Work

`ready.js` loads `scheduledTasks.js`, which registers cron jobs for interest accrual and lake restocking.

## Data Flow

- Most economy commands read and write `Player` documents keyed by `userId` and `guildId`
- Fishing commands read and write `Lake` documents keyed by `guildId`
- Leaderboards aggregate player data by guild

## Operational Notes

- Cooldowns are stored in memory on the Discord client
- Logging uses Winston with optional Logtail transport
- The bot is designed as a single-process application backed by MongoDB
