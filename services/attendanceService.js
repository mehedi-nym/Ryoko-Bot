import {
  createAttendanceRecord,
  createSession,
  deleteSession,
  getActiveSession,
  updateSessionBreakEnd,
  upsertEmployee
} from '../database/repositories.js';
import { parseAttendanceMessage } from '../helpers/messageParser.js';
import { sendDirectMessage } from '../helpers/directMessage.js';
import { saveAttendanceToSheets } from './googleSheetsService.js';
import { formatDateTime, formatDuration, formatTime, now } from '../utils/time.js';
import { logger } from '../utils/logger.js';

const calculateSessionTotals = (session, logoutAt) => {
  const logoutTime = new Date(logoutAt).getTime();
  const loginTime = new Date(session.login_at).getTime();
  const activeBreakMs = session.break_started_at
    ? Math.max(0, logoutTime - new Date(session.break_started_at).getTime())
    : 0;
  const breakMs = Number(session.total_break_ms || 0) + activeBreakMs;
  const totalDurationMs = Math.max(0, logoutTime - loginTime);
  const workingMs = Math.max(0, totalDurationMs - breakMs);

  return {
    totalDurationMs,
    breakMs,
    workingMs
  };
};

export const handleAttendanceMessage = async (message, appConfig) => {
  if (message.author.bot || message.channelId !== appConfig.attendanceChannelId) {
    return;
  }

  const parsedMessage = parseAttendanceMessage(message.content);

  if (!parsedMessage.action) {
    return;
  }

  const discordId = message.author.id;
  const username = message.member?.displayName || message.author.username;

  try {
    await upsertEmployee({ discordId, username });

    if (parsedMessage.action === 'login') {
      await handleLogin({ message, discordId, username, timestampOverride: parsedMessage.timestampOverride });
      return;
    }

    await handleLogout({ message, discordId, timestampOverride: parsedMessage.timestampOverride });
  } catch (error) {
    await logger.error('Attendance workflow failed', { discordId, error: error.message });
    await sendDirectMessage(message.author, 'Something went wrong while processing your attendance. Please contact an admin.');
  }
};

const handleLogin = async ({ message, discordId, username, timestampOverride }) => {
  const activeSession = await getActiveSession(discordId);

  if (activeSession) {
    await logger.warn('Duplicate login attempt', { discordId, username });
    await sendDirectMessage(message.author, `You are already logged in since ${formatDateTime(activeSession.login_at)}.`);
    return;
  }

  const loginAt = timestampOverride || now().toISOString();
  await createSession({ discordId, username, loginAt });
  await logger.info('Login', { discordId, username, loginAt });

  await sendDirectMessage(
    message.author,
    [
      `Logged in successfully at ${formatTime(loginAt)}.`,
      'Please join Ryoko Desk so your workspace activity can be tracked.'
    ].join('\n')
  );
};

const handleLogout = async ({ message, discordId, timestampOverride }) => {
  const activeSession = await getActiveSession(discordId);

  if (!activeSession) {
    await logger.warn('Logout without login', { discordId });
    await sendDirectMessage(message.author, 'You do not have an active login session.');
    return;
  }

  const logoutAt = timestampOverride || now().toISOString();

  if (new Date(logoutAt).getTime() < new Date(activeSession.login_at).getTime()) {
    await sendDirectMessage(
      message.author,
      `Logout time ${formatTime(logoutAt)} is earlier than your login time ${formatTime(activeSession.login_at)}. Please send the correct logout time.`
    );
    return;
  }

  const totals = calculateSessionTotals(activeSession, logoutAt);

  if (activeSession.break_started_at) {
    await updateSessionBreakEnd({ discordId, totalBreakMs: totals.breakMs });
  }

  const attendanceRecord = {
    discordId,
    username: activeSession.username,
    loginAt: activeSession.login_at,
    logoutAt,
    breakMs: totals.breakMs,
    workingMs: totals.workingMs
  };

  await createAttendanceRecord(attendanceRecord);

  let sheetsSaved = true;
  try {
    await saveAttendanceToSheets(attendanceRecord);
  } catch (error) {
    sheetsSaved = false;
  }

  await deleteSession(discordId);
  await logger.info('Logout', { discordId, username: activeSession.username, logoutAt });

  const sheetsNote = sheetsSaved ? '' : '\nGoogle Sheets sync failed, but your attendance was saved locally.';
  await sendDirectMessage(
    message.author,
    [
      'Attendance summary:',
      `Login: ${formatDateTime(activeSession.login_at)}`,
      `Logout: ${formatDateTime(logoutAt)}`,
      `Total Duration: ${formatDuration(totals.totalDurationMs)}`,
      `Break: ${formatDuration(totals.breakMs)}`,
      `Net Working Hours: ${formatDuration(totals.workingMs)}${sheetsNote}`
    ].join('\n')
  );
};
