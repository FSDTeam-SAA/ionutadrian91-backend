import { Injectable } from '@nestjs/common';
import Redis, { Redis as RedisType } from 'ioredis';

@Injectable()
export class RedisService {
  private client: RedisType;
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      username: process.env.REDIS_USER,
      password: process.env.REDIS_PASSWORD,
    });
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.client.get(key);
      if (cachedData) {
        return JSON.parse(cachedData) as T;
      }
      return null;
    } catch (error) {
      console.error('Error getting value from Redis:', error);
      return null;
    }
  }

  async cacheData(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      const data = JSON.stringify(value);
      await this.client.set(key, data, 'EX', ttl);
      console.log(`Data cached for key: ${key}`);
    } catch (error) {
      console.error(`Failed to cache data for key: ${key}`, error);
    }
  }

  deleteCachedData = async (pattern: string): Promise<boolean> => {
    try {
      const matchingKeys = await this.client.keys(pattern);
      if (matchingKeys.length > 0) {
        await Promise.all(matchingKeys.map((key) => this.client.del(key)));
        console.log('Successfully deleted cached data');
      }
      return true;
    } catch (error) {
      console.error('Error deleting cached data:', error);
      return false;
    }
  };

  clearAllCachedData = async () => {
    // const redisClient = await getRedisClient();
    await this.client.flushall();
  };
}
