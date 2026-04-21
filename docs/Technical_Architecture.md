# Technical Architecture

## Runtime Flow

1. `src/main.js` loads environment variables.
2. The Postgres pool is initialized and the schema is ensured.
3. Discord event handlers and slash commands are registered.
4. The bot logs in and starts processing interactions.

## Bot Structure

- `src/handlers/commandHandler.js` loads slash command modules from `src/commands`
- `src/handlers/eventHandler.js` wires Discord events from `src/events`
- `src/modules/` contains business logic for economy, games, rewards, and scheduled jobs
- `src/models/` and `src/storage/` define the Postgres data layer and cache helpers
- `src/utils/` contains shared helpers for embeds, logging, calculations, and role management
- Command files are now thin adapters over reusable service modules, and the remaining direct model/database work lives in `src/modules/` or `src/storage/`
- The core economy and banking flows should behave like reusable service APIs so slash commands stay thin and a future web UI can reuse the same logic
- Clan domain helpers now live in `src/modules/clanService.js` as the reusable boundary for future membership and resource flows
- Blackjack is a split case: `src/commands/gamble/blackjack.js` is a thin command wrapper and `src/modules/games/blackjackGame.js` contains the game engine and response rendering
- The command inventory and category boundaries are documented in [Command_Surface.md](./Command_Surface.md)

## Request Paths

### Slash Commands

Discord interaction -> `interactionCreate` event -> command lookup -> cooldown check -> command module -> response

Most command modules defer the response and delegate work into a module, then render either `createStatusEmbed` or `createBalanceEmbed` so success and failure states stay visually and textually consistent.
For future clan, bank, and lake work, treat the command layer as a transport adapter over reusable service functions instead of the place where rules live.

### Message Rewards

Discord message -> `messageCreate` event -> reward module -> player update -> optional level-up role changes

### Scheduled Work

`ready.js` calls `scheduledTasks.registerScheduledTasks()`, which registers cron jobs for interest accrual and lake restocking.
Those jobs now split the work by entity boundary: daily bank interest runs across player accounts, public lake restocks run against public lake records, and the remaining guild-shaped storage keys are treated as compatibility details rather than the scheduler's primary model.

## Data Flow

- Most economy commands read and write `Player` rows keyed by `userId` and `guildId`
- Fishing commands read and write `Lake` rows keyed by `guildId`
- Leaderboards aggregate player data by guild
- Future clan work will separate global player state from clan-scoped state, so not every `guildId`-based path should be treated as permanent architecture

## Operational Notes

- Cooldowns are stored in memory on the Discord client
- Logging uses Winston with optional Logtail transport
- The bot is designed as a single-process application backed by Postgres with Redis used for cache and ephemeral state
