# Setup and Deployment

## Requirements

- Node.js 24.14.1 through 24.x
- PostgreSQL 14 or newer
- Redis 6 or newer for caching
- Discord bot token

## Install

```bash
git clone https://github.com/Xentradi/Yue.git
cd Yue
npm install
cp .env-example .env
```

Fill in `.env` with:

```env
DISCORD_TOKEN=your_discord_bot_token
DB_URL=postgresql://localhost:5432/yue
REDIS_URL=redis://localhost:6379
LOG_TOKEN=optional_logtail_token
PROFILE_PERFORMANCE=0
PROFILE_SLOW_MS=250
```

## Configuration

`src/config.json` holds the bot's guild-specific settings:

- `clientId`
- `homeServer`
- `devServer`
- `boosterRole`
- `devs`
- `inviteLink`
- `levelRoles`
- economy tuning values

Keep role IDs and server IDs in sync with the Discord server you invite the bot to.

## Run

```bash
npm run dev
```

or

```bash
npm start
```

The bot ships without optional websocket native addons or remote logging by default.
Use `npm run dev` for local development and `npm start` for production.

## Deploy Commands

Slash commands deploy automatically when the bot starts. If the command payload has not changed since the last successful sync, the deploy step is skipped.

For a test-only restart, set `DEPLOY_COMMANDS_ON_STARTUP=0` so the bot boots without touching Discord command registration. Use this when you want to validate the runtime or database state without changing the live slash-command surface.

To force a redeploy, run:

```bash
node src/registerCommands/deployCommands.js --force
```

or set:

```bash
FORCE_COMMAND_DEPLOY=1
```

If you need to clear guild-specific commands during a reset, use:

```bash
node src/registerCommands/deleteGuildCommands.js
```

## Test-Only Restart And Reset

Use this flow when you want to restart the bot without changing Discord command registration:

1. If the current database contains data you need, take a PostgreSQL backup or export first. For the current test-only database, no preservation step is required.
2. Set `DEPLOY_COMMANDS_ON_STARTUP=0`.
3. Start the bot with `npm run dev` or `npm start`.
4. Verify the startup logs show that command deployment was skipped.
5. If you need to fully reset the slash-command surface later, run `node src/registerCommands/deleteGuildCommands.js` and then deploy again with `DEPLOY_COMMANDS_ON_STARTUP=1`.

## Tests

`npm test` runs two layers:

- smoke checks for module shape and duplicate command names
- integration checks against PostgreSQL for core economy flows

`npm run lint` checks the repository with ESLint.

## Notes

- The bot validates `DISCORD_TOKEN` and `DB_URL` at startup.
- Logs are written locally through Winston. If `LOG_TOKEN` is set, Logtail becomes an optional remote transport.
- Set `PROFILE_PERFORMANCE=1` to log command, Postgres, and Redis timings. Use `PROFILE_COMMANDS=1`, `PROFILE_DB=1`, or `PROFILE_CACHE=1` to scope that output more narrowly. `PROFILE_SLOW_MS` controls the slow-operation warning threshold, and slow commands, queries, and cache operations are logged even without a profiling flag.
- Set `DEPLOY_COMMANDS_ON_STARTUP=0` for test-only restarts that should skip Discord command deployment.
- The project does not include a web dashboard or Docker setup.
- Scheduled jobs run from the Discord bot process through `src/modules/scheduledEvents/scheduledTasks.js`, where daily bank interest now runs across player accounts and lake restocks target public lakes directly. Keep PostgreSQL backups current before changing interest or lake-restock timing.
- The current command inventory lives in [Command_Surface.md](./Command_Surface.md).
