# Setup and Deployment

## Requirements

- Node.js 24 LTS
- MongoDB 5 or newer
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
DB_URL=mongodb://localhost:27017/yue
LOG_TOKEN=optional_logtail_token
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

## Deploy Commands

Deploy slash commands after configuration changes:

```bash
node src/registerCommands/deployCommands.js
```

## Tests

`npm test` runs two layers:

- smoke checks for module shape and duplicate command names
- integration checks against an in-memory MongoDB instance for core economy flows

## Notes

- The bot validates `DISCORD_TOKEN` and `DB_URL` at startup.
- Logs are written locally through Winston. If `LOG_TOKEN` is set, Logtail becomes an optional remote transport.
- The project does not include a web dashboard or Docker setup.
