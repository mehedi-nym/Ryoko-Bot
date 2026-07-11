import { handleVoiceStateUpdate } from '../services/voiceService.js';

export const registerVoiceStateUpdateEvent = (client, appConfig) => {
  client.on('voiceStateUpdate', async (oldState, newState) => {
    await handleVoiceStateUpdate(oldState, newState, appConfig);
  });
};
