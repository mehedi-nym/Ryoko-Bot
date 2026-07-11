import { ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';

export const registerReadyEvent = (client) => {
  client.once('ready', async () => {
    client.user.setActivity('RYOKO attendance', { type: ActivityType.Watching });
    await logger.info('Discord bot ready', {
      tag: client.user.tag,
      guilds: client.guilds.cache.size
    });

    console.log(`RYOKO bot is online as ${client.user.tag}`);
  });
};
