import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config, getMissingRequiredVariables } from './config/env.js';
import { initializeDatabase } from './database/migrations.js';
import { initializeGoogleSheets } from './services/googleSheetsService.js';
import { registerReadyEvent } from './events/ready.js';
import { registerMessageCreateEvent } from './events/messageCreate.js';
import { registerVoiceStateUpdateEvent } from './events/voiceStateUpdate.js';
import { registerErrorEvents } from './events/error.js';
import { logger } from './utils/logger.js';

const startBot = async () => {
  const missingVariables = getMissingRequiredVariables();

  if (missingVariables.includes('DISCORD_TOKEN')) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }

  if (missingVariables.length > 0) {
    await logger.warn('Some environment variables are missing', { missingVariables });
    console.warn(`Missing environment variables: ${missingVariables.join(', ')}`);
  }

  await initializeDatabase();

  try {
    await initializeGoogleSheets();
  } catch (error) {
    console.warn(`Google Sheets is not ready: ${error.message}`);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
  });

  registerReadyEvent(client);
  registerMessageCreateEvent(client, config);
  registerVoiceStateUpdateEvent(client, config);
  registerErrorEvents(client);

  await client.login(config.discordToken);
};

process.on('unhandledRejection', async (error) => {
  await logger.error('Unhandled promise rejection', { error: error.message, stack: error.stack });
});

process.on('uncaughtException', async (error) => {
  await logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

await startBot();
