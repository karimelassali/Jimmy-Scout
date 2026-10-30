import { config } from './env.ts';

export const redisConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
};

export function getRedisConfig() {
  return {
    connection: {
      url: config.redisUrl,
      ...redisConnectionOptions,
    },
  };
}
