# Yue

Yue is a Discord bot built around a guild economy, mini-games, leveling, and admin tools. It uses Discord.js, MongoDB, and Mongoose.

## Requirements

- Node.js 24 LTS
- MongoDB
- Discord bot token

## Setup

1. Install dependencies: `npm install`
2. Copy `.env-example` to `.env`
3. Set `DISCORD_TOKEN` and `DB_URL`
4. Update `src/config.json` with your guild and role IDs

## Run

- Development: `npm run dev`
- Production: `npm start`

## Commands

Deploy slash commands with:

```bash
node src/registerCommands/deployCommands.js
```

## Tests

Run the smoke and integration suite with:

```bash
npm test
```

## Docs

- [Setup and Deployment](docs/Setup_and_Deployment.md)
- [Feature Overview](docs/Feature_Overview.md)
- [Technical Architecture](docs/Technical_Architecture.md)
- [Project Summary](docs/Project_Summary.md)
- [Roadmap](docs/TODO_Lists.md)
