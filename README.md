# Yue

Yue is a Discord bot built around a guild economy, mini-games, leveling, and admin tools. It uses Discord.js, MongoDB, and Mongoose.

## Requirements

- Node.js 24.14.1 through 24.x
- MongoDB
- Discord bot token

## Setup

1. Install dependencies: `npm install`
2. Copy `.env-example` to `.env`
3. Set `DISCORD_TOKEN` and `DB_URL`
4. Update `src/config.json` with your guild, role, and tuning values

## Run

- Development: `npm run dev`
- Production: `npm start`

## Commands

The current command surface is grouped by product area:

- Economy: `balance`, `daily`, `deposit`, `leaderboard`, `pay`, `steal`, `withdraw`
- Games: `blackjack`, `coin`, `dice`, `fish`
- Utilities: `help`, `ping`, `support`, `user`
- Admin: `economy`, `restocklake`, `syncroles`

Deploy slash commands after configuration changes with:

```bash
node src/registerCommands/deployCommands.js
```

## Tests

Run the smoke and integration suite with:

```bash
npm test
```

Run lint directly with:

```bash
npm run lint
```

## Docs

- [Setup and Deployment](docs/Setup_and_Deployment.md)
- [Feature Overview](docs/Feature_Overview.md)
- [Command Surface](docs/Command_Surface.md)
- [Command Response Conventions](docs/Command_Response_Conventions.md)
- [Technical Architecture](docs/Technical_Architecture.md)
- [Project Summary](docs/Project_Summary.md)
- [Roadmap](docs/TODO_Lists.md)
