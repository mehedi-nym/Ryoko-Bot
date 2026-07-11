import {
  createVoiceLog,
  getActiveSession,
  updateSessionBreakEnd,
  updateSessionBreakStart,
  upsertEmployee
} from '../database/repositories.js';
import { sendDirectMessage } from '../helpers/directMessage.js';
import { saveVoiceLogToSheets } from './googleSheetsService.js';
import { logger } from '../utils/logger.js';
import { formatDuration, now } from '../utils/time.js';

const getVoiceAction = ({ oldChannelId, newChannelId, appConfig }) => {
  if (oldChannelId === appConfig.ryokoDeskChannelId && newChannelId === appConfig.commonRoomChannelId) {
    return 'Break Started';
  }

  if (oldChannelId === appConfig.commonRoomChannelId && newChannelId === appConfig.ryokoDeskChannelId) {
    return 'Break Ended';
  }

  if (oldChannelId !== appConfig.ryokoDeskChannelId && newChannelId === appConfig.ryokoDeskChannelId) {
    return 'Joined Ryoko Desk';
  }

  if (oldChannelId && !newChannelId) {
    return 'Disconnected From Voice';
  }

  if (!oldChannelId && newChannelId) {
    return 'Reconnected To Voice';
  }

  return null;
};

export const handleVoiceStateUpdate = async (oldState, newState, appConfig) => {
  const member = newState.member || oldState.member;

  if (!member || member.user.bot) {
    return;
  }

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  if (oldChannelId === newChannelId) {
    return;
  }

  const action = getVoiceAction({ oldChannelId, newChannelId, appConfig });

  if (!action) {
    return;
  }

  const discordId = member.id;
  const username = member.displayName || member.user.username;
  const timestamp = now().toISOString();

  try {
    await upsertEmployee({ discordId, username });
    await createVoiceLog({ discordId, username, action, channelId: newChannelId, timestamp });
    await saveVoiceLogToSheets({ timestamp, username, action });
    await logger.info(action, { discordId, username, oldChannelId, newChannelId });

    const breakUpdate = await updateBreakStateIfNeeded({ discordId, action, timestamp });
    await sendVoiceNotification({ user: member.user, action, breakUpdate });
  } catch (error) {
    await logger.error('Voice tracking failed', { discordId, action, error: error.message });
  }
};

const updateBreakStateIfNeeded = async ({ discordId, action, timestamp }) => {
  const activeSession = await getActiveSession(discordId);

  if (!activeSession) {
    return {
      hasActiveSession: false,
      breakDurationMs: 0,
      totalBreakMs: 0,
      changed: false
    };
  }

  if (action === 'Break Started') {
    if (!activeSession.break_started_at) {
      await updateSessionBreakStart({ discordId, breakStartedAt: timestamp });
      return {
        hasActiveSession: true,
        breakDurationMs: 0,
        totalBreakMs: Number(activeSession.total_break_ms || 0),
        changed: true
      };
    }

    return {
      hasActiveSession: true,
      breakDurationMs: 0,
      totalBreakMs: Number(activeSession.total_break_ms || 0),
      changed: false
    };
  }

  if (action === 'Break Ended' && activeSession.break_started_at) {
    const breakDurationMs = Math.max(0, new Date(timestamp).getTime() - new Date(activeSession.break_started_at).getTime());
    const totalBreakMs = Number(activeSession.total_break_ms || 0) + breakDurationMs;
    await updateSessionBreakEnd({ discordId, totalBreakMs });
    return {
      hasActiveSession: true,
      breakDurationMs,
      totalBreakMs,
      changed: true
    };
  }

  return {
    hasActiveSession: true,
    breakDurationMs: 0,
    totalBreakMs: Number(activeSession.total_break_ms || 0),
    changed: false
  };
};

const sendVoiceNotification = async ({ user, action, breakUpdate }) => {
  if (!breakUpdate.hasActiveSession) {
    if (action === 'Joined Ryoko Desk') {
      await sendDirectMessage(user, 'You joined Ryoko Desk, but you are not logged in yet. Please send a login message in the attendance channel.');
    }
    return;
  }

  if (action === 'Joined Ryoko Desk') {
    await sendDirectMessage(user, 'You are now on Ryoko Desk.');
    return;
  }

  if (action === 'Break Started') {
    await sendDirectMessage(user, 'Break started. Please return to Ryoko Desk when your break is finished.');
    return;
  }

  if (action === 'Break Ended') {
    await sendDirectMessage(
      user,
      [
        'You are back on Ryoko Desk.',
        `This break: ${formatDuration(breakUpdate.breakDurationMs)}`,
        `Total break today: ${formatDuration(breakUpdate.totalBreakMs)}`
      ].join('\n')
    );
    return;
  }

  if (action === 'Disconnected From Voice') {
    await sendDirectMessage(user, 'You disconnected from voice. Your attendance session is still active.');
    return;
  }

  if (action === 'Reconnected To Voice') {
    await sendDirectMessage(user, 'You reconnected to voice. Your attendance session is continuing normally.');
  }
};
