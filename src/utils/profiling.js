const { performance } = require('node:perf_hooks');
const logger = require('./logger');

function isTruthy(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function isProfilingEnabled(scope = 'all') {
  if (isTruthy(process.env.PROFILE_PERFORMANCE)) {
    return true;
  }

  const scopeEnv =
    scope === 'db'
      ? process.env.PROFILE_DB
      : scope === 'cache'
        ? process.env.PROFILE_CACHE
        : process.env.PROFILE_COMMANDS;

  return isTruthy(scopeEnv);
}

function getSlowThresholdMs() {
  const parsed = Number(process.env.PROFILE_SLOW_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 250;
}

function logDuration(scope, label, durationMs, detail = '', options = {}) {
  const thresholdMs = getSlowThresholdMs();
  const shouldLog =
    Boolean(options.force) ||
    isProfilingEnabled(scope) ||
    durationMs >= thresholdMs;

  if (!shouldLog) {
    return;
  }

  const suffix = detail ? ` ${detail}` : '';
  const message = `Profile [${scope}] ${label} ${durationMs}ms${suffix}`;
  const level = options.level ?? (durationMs >= thresholdMs ? 'warn' : 'info');

  logger[level](message);
}

function formatDurationBreakdown(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return '';
  }

  return steps
    .map((step) => {
      const durationMs = Number.isFinite(step.durationMs) ? step.durationMs : 0;
      return `${step.label}:${durationMs}ms`;
    })
    .join(', ');
}

async function timeAsync(scope, label, fn, detail = '') {
  const startedAt = performance.now();

  try {
    return await fn();
  } finally {
    const durationMs = Math.round(performance.now() - startedAt);
    logDuration(scope, label, durationMs, detail);
  }
}

module.exports = {
  formatDurationBreakdown,
  getSlowThresholdMs,
  isProfilingEnabled,
  logDuration,
  timeAsync,
};
