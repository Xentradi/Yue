const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createClient } = require('redis');
const logger = require('../utils/logger');
const { logDuration, timeAsync } = require('../utils/profiling');

let clientPromise;
let client;

function summarizeCacheKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return '';
  }

  const versionedMatch = key.match(/^(yue:[^:]+:[^:]+:v\d+)/);
  if (versionedMatch) {
    return versionedMatch[1];
  }

  const versionKeyMatch = key.match(/^(yue:version:[^:]+:[^:]+)/);
  if (versionKeyMatch) {
    return versionKeyMatch[1];
  }

  return key.length > 120 ? `${key.slice(0, 117)}...` : key;
}

function describeVersionTarget(scope, partition = 'global') {
  return `${scope}:${partition}`;
}

function isEnabled() {
  return Boolean(process.env.REDIS_URL?.trim());
}

async function getClient() {
  if (!isEnabled()) {
    return null;
  }

  if (client) {
    return client;
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const redisClient = createClient({
          url: process.env.REDIS_URL.trim(),
        });

        redisClient.on('error', (error) => {
          logger.error(`Redis client error: ${error?.stack ?? error}`);
        });

        await redisClient.connect();
        client = redisClient;
        return redisClient;
      } catch (error) {
        logger.error(`Redis cache unavailable: ${error?.stack ?? error}`);
        clientPromise = undefined;
        client = undefined;
        return null;
      }
    })();
  }

  return await clientPromise;
}

async function closeClient() {
  if (client) {
    try {
      await client.quit();
    } catch {
      try {
        await client.disconnect();
      } catch {
        // Ignore shutdown failures so test cleanup can continue.
      }
    } finally {
      client = undefined;
      clientPromise = undefined;
    }
  } else {
    clientPromise = undefined;
  }
}

async function getJson(key) {
  try {
    const startedAt = performance.now();
    const redisClient = await getClient();
    if (!redisClient) {
      logDuration(
        'cache',
        'GET',
        Math.round(performance.now() - startedAt),
        'disabled',
      );
      return null;
    }

    const raw = await redisClient.get(key);
    const durationMs = Math.round(performance.now() - startedAt);
    const detail = [summarizeCacheKey(key), raw ? 'hit' : 'miss']
      .filter(Boolean)
      .join(' ');
    logDuration('cache', 'GET', durationMs, detail);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setJson(key, value, ttlSeconds = 300) {
  try {
    return await timeAsync(
      'cache',
      'SET',
      async () => {
        const redisClient = await getClient();
        if (!redisClient) {
          return false;
        }

        await redisClient.set(key, JSON.stringify(value), {
          EX: ttlSeconds,
        });
        return true;
      },
      summarizeCacheKey(key),
    );
  } catch {
    return false;
  }
}

async function delKey(key) {
  try {
    return await timeAsync(
      'cache',
      'DEL',
      async () => {
        const redisClient = await getClient();
        if (!redisClient) {
          return false;
        }

        await redisClient.del(key);
        return true;
      },
      summarizeCacheKey(key),
    );
  } catch {
    return false;
  }
}

async function getVersion(scope, partition = 'global') {
  try {
    return await timeAsync(
      'cache',
      'GET_VERSION',
      async () => {
        const redisClient = await getClient();
        if (!redisClient) {
          return 0;
        }

        const raw = await redisClient.get(versionKey(scope, partition));
        return raw ? Number(raw) || 0 : 0;
      },
      describeVersionTarget(scope, partition),
    );
  } catch {
    return 0;
  }
}

async function bumpVersion(scope, partition = 'global') {
  try {
    return await timeAsync(
      'cache',
      'INCR',
      async () => {
        const redisClient = await getClient();
        if (!redisClient) {
          return 0;
        }

        return await redisClient.incr(versionKey(scope, partition));
      },
      describeVersionTarget(scope, partition),
    );
  } catch {
    return 0;
  }
}

function versionKey(scope, partition = 'global') {
  return `yue:version:${scope}:${partition}`;
}

function buildVersionedCacheKey(scope, partition, descriptor, version) {
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(descriptor))
    .digest('hex');
  return `yue:${scope}:${partition}:v${version}:${hash}`;
}

module.exports = {
  buildVersionedCacheKey,
  bumpVersion,
  delKey,
  closeClient,
  describeVersionTarget,
  getClient,
  getJson,
  getVersion,
  isEnabled,
  setJson,
  summarizeCacheKey,
};
