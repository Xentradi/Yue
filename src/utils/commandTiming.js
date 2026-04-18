const { performance } = require('node:perf_hooks');
const logger = require('./logger');

function createCommandMetrics(interaction) {
  const startedAt = performance.now();
  const commandName = interaction.commandName;
  const scope = interaction.guildId ? `guild=${interaction.guildId}` : 'dm';

  return {
    step(label) {
      const stepStartedAt = performance.now();

      return (detail = '') => {
        const durationMs = Math.round(performance.now() - stepStartedAt);
        const suffix = detail ? ` ${detail}` : '';
        logger.info(`Command ${commandName} ${label} ${durationMs}ms${suffix}`);
      };
    },
    finish(status = 'completed', detail = '') {
      const totalMs = Math.round(performance.now() - startedAt);
      const suffix = detail ? ` (${detail})` : '';
      logger.info(
        `Command ${commandName} ${status} in ${totalMs}ms${suffix} [${scope}]`,
      );
    },
  };
}

module.exports = {
  createCommandMetrics,
};
