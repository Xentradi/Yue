# Project Summary

Yue is a Discord bot for a server economy and progression system. It combines slash commands, message rewards, scheduled maintenance, and PostgreSQL persistence into one bot process.

## Stack

- Discord.js
- PostgreSQL and Redis
- Node.js 24.14.1 through 24.x
- Winston logging with optional Logtail transport

## Current Scope

- Economy: cash, bank, debt, loans, transfers, daily rewards, and leaderboards
- Games: fishing, coin flip, dice, blackjack
- Progression: XP, levels, and level-based roles
- Utilities: help, ping, support links, and user profiles
- Admin: balance control, lake restocking, role syncing

## Operational Notes

- The command surface is grouped by economy, games, utilities, and admin so help output matches how users think about the bot
- Admin commands are intended for guild use only and require administrator permissions
- The current command inventory is documented in [Command_Surface.md](./Command_Surface.md)

## Maintenance Notes

- The bot depends on `src/config.json` for guild-specific IDs and tuning values
- Startup expects `DISCORD_TOKEN` and `DB_URL`
- Several commands and modules are written in a way that makes dependency and runtime upgrades worth testing carefully
