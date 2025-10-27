# Technical Architecture

## System Overview

Yue is a Discord bot application that leverages event-driven architecture to handle user interactions and scheduled tasks. The system is built with modularity in mind, separating concerns between command handling, event processing, data management, and business logic.

## Application Flow

### Startup Sequence
1. **Environment Loading**: Load configuration from `.env` file
2. **Database Connection**: Establish MongoDB connection via Mongoose
3. **Event Registration**: Load and register Discord event handlers
4. **Command Registration**: Load and register slash commands
5. **Scheduled Tasks**: Initialize recurring tasks (currently commented out)
6. **Bot Login**: Authenticate with Discord API

### Request Flow - Command Execution
1. **Interaction Received**: Discord sends interaction payload
2. **Event Handler**: `interactionCreate.js` receives the event
3. **Command Resolution**: Lookup command in client.commands collection
4. **Cooldown Check**: Verify user hasn't exceeded rate limits
5. **Execution**: Run command logic with provided parameters
6. **Response**: Send result back to Discord

### Request Flow - Message Events
1. **Message Received**: Discord sends message payload
2. **Event Handler**: `messageCreate.js` receives the event
3. **Bot Filter**: Skip processing if message from bot
4. **Reward Processing**: Apply message rewards (currency/XP)
5. **Content Processing**: Handle any additional message-based features

## Core Components

### Event System
- **interactionCreate.js**: Handles slash command interactions
  - Cooldown management with per-user, per-guild tracking
  - Error handling with user feedback
  - Command execution with parameter passing
- **messageCreate.js**: Processes message events
  - Currently focused on reward distribution
- **ready.js**: Bot initialization and startup tasks
  - Loads scheduled tasks module

### Command System
- **commandHandler.js**: Dynamic command loading
  - Scans `commands/` directory recursively
  - Registers commands to Discord client
  - Validates command structure (data + execute)
- **Organized Structure**: Commands grouped by functionality
  - `admin/`: Administrative commands
  - `economy/`: Economic operations
  - `fun/`: Entertainment features
  - `gamble/`: Gambling games
  - `utilities/`: Utility functions

### Database Layer
- **Mongoose Models**: Abstraction over MongoDB collections
- **Player Model**: Comprehensive user data management
- **Lake Model**: Fishing game resource management
- **Schema Validation**: Strong typing with Mongoose schemas
- **Transaction Support**: Atomic operations for currency transfers

### Module System
- **Business Logic Separation**: Complex operations in dedicated modules
- **Economy Modules**: Banking, loans, transfers, admin operations
- **Game Modules**: Fishing, gambling games, leaderboards
- **Utility Modules**: Embed creation, logging, calculations

## Data Flow Patterns

### Economy Operations
```
User Command → Command Handler → Module Function → Database Operation → Response
    ↓              ↓              ↓              ↓              ↓
balance.js   →   getBalance   →   Player.find  →   Format   →   Embed Reply
```

### Game Operations
```
User Command → Command Handler → Game Module → Random Logic → Database Update → Result Embed
    ↓              ↓              ↓              ↓              ↓              ↓
  fish.js    →   fishing.js    →   weightedRandom →   Player.updateCash →   Success/Fail Embed
```

## Configuration Management

### Environment Variables
- Runtime configuration via `.env` file
- Sensitive data isolation (tokens, URLs)
- Development vs production environments

### Static Configuration
- `config.json`: Economy parameters, role mappings
- Server-specific settings
- Feature toggles and constants

## Error Handling Strategy

### User-Facing Errors
- Command cooldown notifications
- Insufficient funds messages
- Generic error responses for system failures
- Ephemeral replies for sensitive errors

### System Errors
- Winston logging with multiple transports
- Logtail integration for cloud logging
- Daily log rotation
- Structured error context

## Performance Considerations

### Command Cooldowns
- Per-command configurable cooldowns
- Per-user, per-guild tracking
- Automatic cleanup of expired cooldowns

### Database Optimization
- Indexed queries (userId + guildId)
- Aggregation pipelines for leaderboards
- Transactional consistency for transfers

### Memory Management
- Collection-based cooldown storage
- Efficient object reuse
- Minimal persistent state

## Extensibility Points

### Adding New Commands
1. Create command file in appropriate category
2. Implement SlashCommandBuilder structure
3. Define cooldown (optional)
4. Add business logic in execute function

### Adding New Modules
1. Create module file in appropriate directory
2. Export pure functions for business logic
3. Handle database interactions within module
4. Ensure proper error handling and logging

### Database Schema Changes
1. Update schema files in `schemas/`
2. Implement migration logic if needed
3. Update related models and modules
4. Ensure backward compatibility

## Monitoring & Observability

### Logging Levels
- **ERROR**: Critical failures requiring attention
- **WARN**: Non-critical issues or deprecated features
- **INFO**: Normal operation events (command usage)
- **DEBUG**: Detailed execution information

### Metrics Collection
- Command usage tracking
- Error rate monitoring
- Performance timing
- User engagement statistics

## Deployment Architecture

### Single Instance
- Current design supports single bot instance
- Global slash commands for consistency
- Per-guild data isolation via guildId field

### Scaling Considerations
- Stateless design enables horizontal scaling
- Shared MongoDB for data consistency
- Redis could be added for session management
- Load balancing via Discord's built-in sharding

## Security Measures

### Input Validation
- Discord.js built-in sanitization
- Parameter type checking via slash commands
- Database query parameter validation

### Rate Limiting
- Command cooldowns prevent abuse
- Discord API rate limit compliance
- Transaction limits in economy operations

### Data Protection
- Sensitive data in environment variables
- No plaintext password storage
- Guild-scoped data isolation
