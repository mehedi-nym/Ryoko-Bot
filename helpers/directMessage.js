import { logger } from '../utils/logger.js';

export const sendDirectMessage = async (user, content) => {
  try {
    await user.send(content);
    return true;
  } catch (error) {
    await logger.warn('Failed to send direct message', {
      userId: user.id,
      error: error.message
    });
    return false;
  }
};
