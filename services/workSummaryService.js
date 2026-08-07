import { getActiveSession, getAttendanceRecordsSince } from '../database/repositories.js';
import { parseWorkSummaryRequest } from '../helpers/workSummaryParser.js';
import { sendDirectMessage } from '../helpers/directMessage.js';
import { formatDateTime, formatDuration, getPeriodStart, now } from '../utils/time.js';
import { logger } from '../utils/logger.js';

const periodLabels = {
  today: 'Today',
  week: 'This week',
  month: 'This month'
};

const calculateActiveSessionWorkingMs = (session) => {
  if (!session) {
    return 0;
  }

  const currentTimestamp = now().toISOString();
  const currentTime = new Date(currentTimestamp).getTime();
  const loginTime = new Date(session.login_at).getTime();
  const activeBreakMs = session.break_started_at
    ? Math.max(0, currentTime - new Date(session.break_started_at).getTime())
    : 0;
  const totalBreakMs = Number(session.total_break_ms || 0) + activeBreakMs;
  const totalSessionMs = Math.max(0, currentTime - loginTime);

  return Math.max(0, totalSessionMs - totalBreakMs);
};

export const handleWorkSummaryMessage = async (message, client) => {
  if (message.author.bot) {
    return false;
  }

  const isDirectMessage = message.channel?.isDMBased?.() || false;
  const mentionsBot = client?.user && message.mentions?.users?.has(client.user.id);

  if (!isDirectMessage && !mentionsBot) {
    return false;
  }

  const period = parseWorkSummaryRequest(message.content);

  if (!period) {
    if (isDirectMessage) {
      await sendDirectMessage(
        message.author,
[
  '👋 Hey! This is Ryoko Bot.',
  '',
  'I help manage your remote workstation and keep track of your work activity and attendance. 💻📊',
  '',
  '🖥️ Remote Workstation',
  '• I’ll notify you when your remote work session starts or ends.',
  '• I can keep you updated about your workstation status.',
  '',
  '💬 You can also ask me here:',
  '• "today hours" — Check your working hours today.',
  '• "this week worked" — View your total working hours this week.',
  '• "this month attendance" — Check your attendance summary for this month.',
  '',
  '🔔 I’ll notify you here whenever your work activity is recorded or your session status changes.',
  '',
  '🤖 Ryoko Bot - Keeping your remote work organized and tracked.'
].join('\n')
      );
      return true;
    }

    return false;
  }

  try {
    const discordId = message.author.id;
    const since = getPeriodStart(period);
    const attendanceRecords = await getAttendanceRecordsSince({ discordId, since });
    const activeSession = await getActiveSession(discordId);

    const completedWorkingMs = attendanceRecords.reduce((total, record) => total + Number(record.working_ms || 0), 0);
    const completedBreakMs = attendanceRecords.reduce((total, record) => total + Number(record.break_ms || 0), 0);
    const activeWorkingMs = calculateActiveSessionWorkingMs(activeSession);
    const totalWorkingMs = completedWorkingMs + activeWorkingMs;

    const activeSessionText = activeSession
      ? `Active session: since ${formatDateTime(activeSession.login_at)}`
      : 'Active session: none';

    await sendDirectMessage(
      message.author,
      [
        `${periodLabels[period]} summary:`,
        `Completed shifts: ${attendanceRecords.length}`,
        `Completed break: ${formatDuration(completedBreakMs)}`,
        `Completed working hours: ${formatDuration(completedWorkingMs)}`,
        `Including active session: ${formatDuration(totalWorkingMs)}`,
        activeSessionText
      ].join('\n')
    );

    return true;
  } catch (error) {
    await logger.error('Work summary failed', { userId: message.author.id, error: error.message });
    await sendDirectMessage(message.author, 'I could not load your work summary right now. Please try again later.');
    return true;
  }
};
