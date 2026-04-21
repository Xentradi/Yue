require('dotenv').config();
const { REST, Routes } = require('discord.js');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config.json');
const logger = require('../utils/logger');

const clientId = config.clientId;
const guildId = config.devServer;
const deployStatePath = path.join(
  __dirname,
  '../../.cache/command-deploy-state.json',
);

function isTruthy(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function buildDeploySignature(globalCommands, guildCommands) {
  const payload = {
    clientId,
    guildId,
    globalCommands,
    guildCommands,
  };

  return crypto
    .createHash('sha256')
    .update(stableStringify(payload))
    .digest('hex');
}

function readDeployState() {
  try {
    const raw = fs.readFileSync(deployStatePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.signature === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function writeDeployState(signature, details = {}) {
  fs.mkdirSync(path.dirname(deployStatePath), { recursive: true });
  fs.writeFileSync(
    deployStatePath,
    JSON.stringify(
      {
        signature,
        updatedAt: new Date().toISOString(),
        ...details,
      },
      null,
      2,
    ),
  );
}

async function deployCommands(options = {}) {
  const commands = [];

  const foldersPath = path.join(__dirname, '../commands');
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        commands.push({
          data: command.data.toJSON(),
          deployGlobal: command.deployGlobal,
        });
      } else {
        logger.warn(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  logger.info(
    `Started refreshing ${commands.length} application (/) commands.`,
  );

  const globalCommands = commands
    .filter((cmd) => cmd.deployGlobal)
    .map((cmd) => cmd.data);
  const guildCommands = commands
    .filter((cmd) => !cmd.deployGlobal)
    .map((cmd) => cmd.data);
  const signature = buildDeploySignature(globalCommands, guildCommands);
  const forceDeploy =
    options.force === true || isTruthy(process.env.FORCE_COMMAND_DEPLOY);
  const lastDeploy = readDeployState();

  if (!forceDeploy && lastDeploy?.signature === signature) {
    logger.info(
      `Slash command payload unchanged; skipping Discord sync for ${commands.length} application (/) commands.`,
    );
    return {
      skipped: true,
      signature,
      globalCount: globalCommands.length,
      guildCount: guildCommands.length,
    };
  }

  if (globalCommands.length > 0) {
    await rest.put(Routes.applicationCommands(clientId), {
      body: globalCommands,
    });
    logger.info(`Deployed ${globalCommands.length} global commands.`);
  }

  if (guildCommands.length > 0) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: guildCommands,
    });
    logger.info(`Deployed ${guildCommands.length} guild-specific commands.`);
  }

  writeDeployState(signature, {
    globalCount: globalCommands.length,
    guildCount: guildCommands.length,
  });

  logger.info(
    `Successfully reloaded ${commands.length} application (/) commands.`,
  );

  return {
    skipped: false,
    signature,
    globalCount: globalCommands.length,
    guildCount: guildCommands.length,
  };
}

module.exports = deployCommands;
module.exports.deployCommands = deployCommands;

if (require.main === module) {
  deployCommands({ force: process.argv.includes('--force') }).catch((err) => {
    logger.error(`Error deploying commands: ${err}`);
    process.exitCode = 1;
  });
}
