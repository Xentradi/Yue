# Yue Discord Bot - Project Summary

## Overview

**Yue** (formerly "bailan") is a comprehensive Discord economy bot built with Discord.js v14. It provides a full-featured virtual economy system with gaming, social features, and administrative controls.

## Architecture

### Technology Stack
- **Framework**: Discord.js v14
- **Database**: MongoDB with Mongoose ODM
- **Language**: Node.js
- **Logging**: Winston with Logtail integration
- **Code Quality**: ESLint, Prettier, TypeScript ready

### Project Structure
```
Yue/
├── src/
│   ├── commands/          # Slash commands by category
│   ├── events/           # Discord event handlers
│   ├── handlers/         # Command and event processing
│   ├── models/           # Mongoose models
│   ├── modules/          # Business logic modules
│   ├── schemas/          # Database schemas
│   ├── utils/            # Utility functions
│   ├── config.json       # Configuration settings
│   └── main.js           # Entry point
├── docs/                 # Project documentation
└── package.json          # Dependencies and scripts
```

## Core Features

### Economy System
- **Currency Management**: Cash, bank accounts, debt tracking
- **Daily Rewards**: Automated bonus system with streak tracking
- **Banking System**: Interest-bearing accounts with deposit/withdrawal
- **Loan System**: Borrowing mechanics with repayment
- **Payment System**: Transfer currency between users
- **Multipliers**: Experience and cash bonuses for boosters/activity

### Gaming Features
- **Fishing System**: Complex mini-game with multiple fish types, rarities, and rewards
- **Gambling Games**: Blackjack, coin flip, dice rolling
- **Leaderboards**: Rankings for cash, debt, levels, and experience

### Social Features
- **Leveling System**: Experience-based progression with automated role rewards
- **Message Rewards**: Earn currency/XP for chat activity
- **Reputation System**: User interaction mechanics
- **Role Management**: Automatic role assignment based on levels

### Administrative Features
- **Economy Management**: Balance manipulation, resets, airdrops
- **Game Management**: Lake restocking, game controls
- **Role Synchronization**: Automated role management
- **Server Management**: Guild-specific configurations

## Database Design

### Player Schema
- **Basic Info**: userId, guildId, username
- **Economy**: cash, bank, debt, netWorth
- **Progression**: exp, level, reputation, relationship
- **Modifiers**: expMultiplier, cashMultiplier, interestMultiplier
- **Tracking**: lastDailyBonusClaim, stats

### Lake Schema
- **Resources**: fish populations, restock timers
- **Management**: administrative controls

## Current State Assessment

### Strengths
✅ Well-structured modular architecture
✅ Comprehensive economy and gaming systems
✅ Robust error handling and logging
✅ TypeScript configuration ready
✅ Extensive feature set

### Areas for Attention
❌ Some features commented out (scheduled tasks)
❌ Incomplete environment configuration
❌ Missing comprehensive tests
❌ Potential dependency updates needed

## Dependencies

### Runtime Dependencies
- discord.js: ^14.13.0 (Discord API wrapper)
- mongoose: ^7.6.2 (MongoDB ODM)
- winston: ^3.11.0 (Logging framework)
- winston-daily-rotate-file: ^4.7.1 (Log rotation)
- @logtail/node & @logtail/winston (Cloud logging)
- node-cron: ^3.0.2 (Scheduled tasks)
- dotenv: ^16.3.1 (Environment variables)

### Dev Dependencies
- eslint & plugins (Code linting)
- gts ^5.2.0 (Google TypeScript Style)
- nodemon ^3.0.1 (Development server)
- typescript ~5.2.0 (Type safety)

## Configuration

### Environment Variables Required
- DISCORD_TOKEN: Bot authentication token
- DB_URL: MongoDB connection string
- LOG_TOKEN: Logtail API token (optional)
- DEV_SERVER: Development guild ID
- HOME_SERVER: Production guild ID

### Config File (config.json)
- Server IDs, client configuration
- Economy parameters (rates, bonuses)
- Role mappings for leveling system

## Deployment Notes

- Uses global slash commands by default
- Supports guild-specific configurations
- Requires MongoDB instance
- Logging can be configured for cloud services
- No active web components (pure Discord bot)
