import { logger } from '../utils/logger.js';

export const registerErrorEvents = (client) => {
  client.on('error', async (error) => {
    await logger.error('Discord client error', { error: error.message });
  });

  client.on('shardError', async (error) => {
    await logger.error('Discord shard error', { error: error.message });
  });

  client.on('shardReconnecting', async (id) => {
    await logger.warn('Discord reconnecting', { shardId: id });
  });

  client.on('shardResume', async (id, replayedEvents) => {
    await logger.info('Discord reconnected', { shardId: id, replayedEvents });
  });
};
