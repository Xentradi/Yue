const { performance } = require('node:perf_hooks');
const {
  formatDurationBreakdown,
  getSlowThresholdMs,
  isProfilingEnabled,
  logDuration,
} = require('./profiling');

function createCommandMetrics(interaction) {
  const startedAt = performance.now();
  const commandName = interaction.commandName;
  const scope = interaction.guildId ? `guild=${interaction.guildId}` : 'dm';
  const commandContext = `command=${commandName} ${scope}`;
  const profiled = isProfilingEnabled('commands');
  const slowThresholdMs = getSlowThresholdMs();
  const steps = [];

  return {
    step(label) {
      const stepStartedAt = performance.now();

      return (detail = '') => {
        const durationMs = Math.round(performance.now() - stepStartedAt);
        steps.push({ label, durationMs });
        const detailParts = [commandContext, detail].filter(Boolean).join(' ');
        logDuration(
          'commands',
          `${commandName} ${label}`,
          durationMs,
          detailParts,
        );
      };
    },
    finish(status = 'completed', detail = '') {
      const totalMs = Math.round(performance.now() - startedAt);
      const breakdown = formatDurationBreakdown(steps);
      const suffixParts = [commandContext];

      if (detail) {
        suffixParts.push(detail);
      }

      if (profiled && breakdown) {
        suffixParts.push(`steps=${breakdown}`);
      }

      if (status !== 'failed' && totalMs < slowThresholdMs && !profiled) {
        return {
          commandName,
          status,
          totalMs,
          steps: [...steps],
        };
      }

      const logOptions =
        status === 'failed'
          ? {
              force: true,
              level: 'warn',
            }
          : {};

      logDuration(
        'commands',
        `${commandName} ${status}`,
        totalMs,
        suffixParts.join(' '),
        logOptions,
      );

      return {
        commandName,
        status,
        totalMs,
        steps: [...steps],
      };
    },
  };
}

module.exports = {
  createCommandMetrics,
};
