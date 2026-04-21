const assert = require('node:assert/strict');
const test = require('node:test');

const logger = require('../src/utils/logger');
const { createCommandMetrics } = require('../src/utils/commandTiming');
const {
  describeQueryDetail,
  describeQueryLabel,
} = require('../src/storage/postgres');
const {
  describeVersionTarget,
  summarizeCacheKey,
} = require('../src/storage/cache');
const { logDuration } = require('../src/utils/profiling');

function setEnv(entries) {
  const previousValues = new Map();

  for (const [key, value] of Object.entries(entries)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

async function captureLogs(callback) {
  const infoMessages = [];
  const warnMessages = [];
  const originalInfo = logger.info;
  const originalWarn = logger.warn;

  logger.info = (message) => {
    infoMessages.push(message);
  };
  logger.warn = (message) => {
    warnMessages.push(message);
  };

  try {
    await callback({ infoMessages, warnMessages });
  } finally {
    logger.info = originalInfo;
    logger.warn = originalWarn;
  }

  return { infoMessages, warnMessages };
}

test('profiling logs stay quiet unless enabled or slow', async () => {
  const restoreEnv = setEnv({
    PROFILE_PERFORMANCE: '0',
    PROFILE_COMMANDS: '0',
    PROFILE_DB: '0',
    PROFILE_CACHE: '0',
    PROFILE_SLOW_MS: '250',
  });

  try {
    const { infoMessages, warnMessages } = await captureLogs(async () => {
      logDuration('commands', 'balance', 40, 'command=balance guild=guild-1');
    });

    assert.deepEqual(infoMessages, []);
    assert.deepEqual(warnMessages, []);
  } finally {
    restoreEnv();
  }
});

test('profiling honors command scope and slow warnings', async () => {
  const restoreEnv = setEnv({
    PROFILE_PERFORMANCE: '0',
    PROFILE_COMMANDS: '1',
    PROFILE_DB: '0',
    PROFILE_CACHE: '0',
    PROFILE_SLOW_MS: '10',
  });

  try {
    const { infoMessages, warnMessages } = await captureLogs(async () => {
      logDuration('commands', 'balance', 5, 'command=balance guild=guild-1');
      logDuration('db', 'SELECT', 15, 'rows=1');
    });

    assert.equal(
      infoMessages[0],
      'Profile [commands] balance 5ms command=balance guild=guild-1',
    );
    assert.equal(warnMessages[0], 'Profile [db] SELECT 15ms rows=1');
  } finally {
    restoreEnv();
  }
});

test('command metrics record step timings and failed commands', async () => {
  const restoreEnv = setEnv({
    PROFILE_PERFORMANCE: '0',
    PROFILE_COMMANDS: '1',
    PROFILE_DB: '0',
    PROFILE_CACHE: '0',
    PROFILE_SLOW_MS: '250',
  });

  try {
    const { infoMessages, warnMessages } = await captureLogs(async () => {
      const metrics = createCommandMetrics({
        commandName: 'balance',
        guildId: 'guild-123',
      });

      metrics.step('discord reply')('reply sent');
      metrics.finish('completed', 'rendered');
      metrics.finish('failed', 'boom');
    });

    assert.match(
      infoMessages[0],
      /^Profile \[commands\] balance discord reply \d+ms command=balance guild=guild-123 reply sent$/,
    );
    assert.match(
      infoMessages[1],
      /^Profile \[commands\] balance completed \d+ms command=balance guild=guild-123 rendered steps=discord reply:\d+ms$/,
    );
    assert.match(
      warnMessages[0],
      /^Profile \[commands\] balance failed \d+ms command=balance guild=guild-123 boom(?: steps=discord reply:\d+ms)?$/,
    );
  } finally {
    restoreEnv();
  }
});

test('postgres and cache profiling labels stay concise', () => {
  assert.equal(describeQueryLabel('  select * from players'), 'SELECT');
  assert.equal(
    describeQueryDetail('SELECT * FROM players FOR UPDATE', 4),
    'rows=4 lock=update',
  );
  assert.equal(
    summarizeCacheKey('yue:player:guild-1:v7:abcdef'),
    'yue:player:guild-1:v7',
  );
  assert.equal(describeVersionTarget('player', 'guild-1'), 'player:guild-1');
});
