import Redis, { Redis as RedisType } from 'ioredis';

let redisClient: RedisType | null = null;

export const getRedisClient = (): RedisType => {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      username: process.env.REDIS_USER,
      password: process.env.REDIS_PASSWORD,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  return redisClient;
};

export const closeRedisConnection = (): void => {
  if (redisClient) {
    void redisClient.quit();
    redisClient = null;
  }
};
