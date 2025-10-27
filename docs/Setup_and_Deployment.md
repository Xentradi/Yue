# Setup and Deployment Guide

## Prerequisites

### System Requirements
- **Node.js**: v18.0.0 or higher
- **MongoDB**: v5.0 or higher (local or cloud instance)
- **Discord Bot Token**: Obtained from Discord Developer Portal
- **Git**: For version control
- **Package Manager**: npm (comes with Node.js)

### Development Environment
- **Code Editor**: VS Code recommended
- **Version Control**: Git
- **Testing**: Basic understanding of terminal commands

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/Xentradi/Yue.git
cd Yue
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create `.env` file from the example:
```bash
cp .env-example .env
```

Edit `.env` with your configuration:
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_application_id_here

# Server Configuration
HOME_SERVER=your_main_guild_id
DEV_SERVER=your_dev_guild_id

# Database Configuration
DB_URL=mongodb://localhost:27017/yue
# Or for MongoDB Atlas:
# DB_URL=mongodb+srv://username:password@cluster.mongodb.net/yue

# Logging (Optional)
LOG_TOKEN=your_logtail_token_here
```

## Discord Bot Setup

### 1. Create Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "Yue")
4. Go to "Bot" section in the left sidebar
5. Click "Add Bot"

### 2. Configure Bot Permissions
In the "Bot" section:
- **Username**: Set desired bot name
- **Avatar**: Upload bot avatar
- **Public Bot**: Set as needed (recommended: OFF)
- **Requires OAuth2 Code Grant**: OFF

### 3. Bot Permissions
The bot needs these permissions (integer: 541668666463):
- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History
- Add Reactions
- Use External Emojis
- Manage Roles (for role management features)

### 4. Get Application ID
From "General Information" section:
- Copy "Application ID" → use as CLIENT_ID in .env

### 5. Get Bot Token
From "Bot" section:
- Click "Reset Token" (if needed)
- Copy the token → use as DISCORD_TOKEN in .env

### 6. Invite Bot to Server
Generate invite URL:
```
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot&permissions=541668666463
```
Replace YOUR_APPLICATION_ID and use the URL to invite the bot.

## Database Setup

### Option 1: Local MongoDB
```bash
# Install MongoDB Community Edition
# macOS with Homebrew:
brew install mongodb-community
brew services start mongodb/brew/mongodb-community

# Verify installation
mongosh --eval "db.adminCommand('ismaster')"
```

### Option 2: MongoDB Atlas (Cloud)
1. Create account at [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a new cluster (free tier available)
3. Create database user
4. Whitelist your IP (0.0.0.0/0 for development)
5. Get connection string from "Connect" section
6. Update DB_URL in .env

## Configuration Files

### config.json
This file contains server-specific settings:
```json
{
  "homeServer": "your_main_guild_id",
  "devServer": "your_dev_guild_id",
  "clientId": "your_application_id",
  "boosterRole": "booster_role_id",
  "devs": ["developer_user_id"],
  "inviteLink": "your_invite_link",
  "boosterExpBonus": 3,
  "boosterCashBonus": 3,
  "cashPerMessage": 5,
  "expScale": 0.065,
  "minExp": 1,
  "maxExp": 15,
  "dailyWage": 1000,
  "levelRoles": {
    "1": "role_id_for_level_1",
    "5": "role_id_for_level_5",
    "10": "role_id_for_level_10",
    "20": "role_id_for_level_20",
    "40": "role_id_for_level_40",
    "80": "role_id_for_level_80",
    "160": "role_id_for_level_160",
    "320": "role_id_for_level_320",
    "640": "role_id_for_level_640",
    "1000": "role_id_for_level_1000"
  }
}
```

### Level Roles Setup
1. Create roles in your Discord server with appropriate names
2. Copy role IDs to config.json levelRoles section
3. Ensure bot has "Manage Roles" permission
4. Place roles in correct hierarchy (higher levels above lower ones)

## Running the Bot

### Development Mode
```bash
# Run with auto-restart on file changes
npm run dev
# or
npx nodemon src/main.js
```

### Production Mode
```bash
# Start the bot
node src/main.js
```

### Register Commands
After first run, deploy slash commands:
```bash
node src/registerCommands/deployCommands.js
```
For guild-specific commands (faster updates during development):
```bash
node src/registerCommands/deployCommands.js guild [guild_id]
```

## Testing

### Run Existing Tests
```bash
npm test
```

### Manual Testing
1. **Bot Startup**: Confirm bot appears online
2. **Basic Commands**: Test `/ping`, `/balance`
3. **Economy Features**: Test `/daily`, messaging rewards
4. **Games**: Test `/fish`, `/coin`
5. **Admin Commands**: Test with developer accounts

### Check Logs
Bot logs are written to `logs/yue-YYYY-MM-DD.log` and console.

## Deployment Options

### Manual Deployment (VPS/Cloud Server)
1. Set up server with Node.js and MongoDB
2. Clone repository
3. Configure environment variables
4. Use process manager like PM2:
```bash
npm install -g pm2
pm2 start src/main.js --name yue
pm2 save
pm2 startup
```

### Docker Deployment
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "src/main.js"]
```

Build and run:
```bash
docker build -t yue-bot .
docker run -d --env-file .env yue-bot
```

### Cloud Platform Deployment
- **Railway**: Connect GitHub repo, auto-deploy
- **Heroku**: Use Node.js buildpack
- **DigitalOcean App Platform**: Git-based deployment
- **AWS EC2**: Manual VPS setup
- **Google Cloud Run**: Containerized deployment

## Monitoring & Maintenance

### Logging
- Check `logs/` directory for application logs
- Monitor Logtail dashboard for cloud logging
- Review error patterns and debug information

### Database Maintenance
```bash
# Connect to MongoDB
mongosh "your_connection_string"

# Check database stats
use yue
db.stats()

# View collections
show collections

# Query player data
db.players.find().limit(5)
```

### Performance Monitoring
- Monitor Discord bot latency
- Check MongoDB connection health
- Review command usage patterns
- Watch for rate limit warnings

## Troubleshooting

### Common Issues

#### Bot Not Starting
- Check DISCORD_TOKEN in .env
- Verify bot permissions in Discord Developer Portal
- Ensure MongoDB is running and accessible
- Check firewall settings

#### Commands Not Registering
- Run deployCommands.js script
- Check bot has applications.commands scope
- Verify CLIENT_ID matches Discord application
- Wait up to 1 hour for global command propagation

#### Database Connection Errors
- Verify DB_URL format
- Check MongoDB credentials
- Ensure network connectivity
- Confirm database user permissions

#### Permission Errors
- Add bot to server with correct permissions
- Check role hierarchy for role management
- Verify bot's role position in server settings

### Debug Mode
Enable debug logging by changing log level in `src/utils/logger.js`:
```javascript
level: 'debug'
```

### Support
- Check existing issues on GitHub
- Review Discord.js documentation
- Consult MongoDB documentation
- Check Winston logging documentation

## Security Best Practices

### Environment Variables
- Never commit .env file to version control
- Use strong, unique passwords
- Rotate tokens regularly
- Limit database user permissions

### Bot Permissions
- Use minimal required permissions
- Regularly audit bot's access
- Monitor for suspicious activity
- Keep dependencies updated

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for any web integrations
- Implement rate limiting
- Regular security audits

## Backup & Recovery

### Database Backup
```bash
# MongoDB dump
mongodump --db yue --out backup_$(date +%Y%m%d)

# Restore from backup
mongorestore --db yue backup_20231201/yue
```

### Configuration Backup
- Backup .env file securely
- Document server-specific configurations
- Version control config.json changes

## Updating the Bot

### Minor Updates
```bash
git pull
npm install
npm run lint
npm test
```

### Major Updates
1. Review changelog/release notes
2. Backup database
3. Test in development environment
4. Update dependencies
5. Deploy gradually (canary deployment if possible)
6. Monitor for issues
7. Rollback plan ready

## Performance Optimization

### Database Tuning
- Add indexes on frequently queried fields
- Monitor slow queries
- Use aggregation pipelines efficiently
- Implement connection pooling

### Code Optimization
- Profile memory usage
- Optimize expensive operations
- Use caching where appropriate
- Implement proper error boundaries

This guide should get you from zero to a running Yue bot instance. Remember to thoroughly test all features before deploying to production.
