const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('REDIS_URL missing. Redis client will not be initialized.');
}

const redis = redisUrl ? new Redis(redisUrl) : null;

if (redis) {
  redis.on('error', (err) => console.error('Redis Client Error', err));
  redis.on('connect', () => console.log('Redis Client Connected'));
}

module.exports = redis;
