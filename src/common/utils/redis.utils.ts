/**
 * Redis utility functions for caching
 */

import { getRedisClient } from '../config/redis.config';

/**
 * Cache data in Redis
 */
export const cacheData = async (
  key: string,
  value: unknown,
  ttl: number,
): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const data = JSON.stringify(value);
    await redisClient.setex(key, ttl, data);
    console.log(`Data cached for key: ${key}`);
  } catch (error) {
    console.error(`Failed to cache data for key: ${key}`, error);
    throw error;
  }
};

/**
 * Get cached data from Redis
 */
export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const redisClient = getRedisClient();
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }
    return null;
  } catch (error) {
    console.error('Error getting value from Redis:', error);
    return null;
  }
};

/**
 * Delete cached data from Redis
 */
export const deleteCachedData = async (pattern: string): Promise<boolean> => {
  try {
    const redisClient = getRedisClient();
    const matchingKeys = await redisClient.keys(pattern);
    if (matchingKeys.length > 0) {
      await Promise.all(matchingKeys.map((key) => redisClient.del(key)));
      console.log('Successfully deleted cached data');
    }
    return true;
  } catch (error) {
    console.error('Error deleting cached data:', error);
    return false;
  }
};
