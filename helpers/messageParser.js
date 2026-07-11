import { LOGIN_MESSAGES, LOGOUT_MESSAGES } from '../config/constants.js';
import { parseDhakaTimeForToday } from '../utils/time.js';

const attendanceWithTimePattern = /^(logged\s+in|login|start|logged\s+out|logout|finish)\s*\(\s*(\d{1,2}[:.]\d{2}\s*(?:am|pm))\s*\)$/i;

export const parseAttendanceMessage = (content) => {
  const trimmedContent = content.trim();
  const normalizedContent = trimmedContent.toLowerCase();
  const attendanceWithTimeMatch = trimmedContent.match(attendanceWithTimePattern);

  if (attendanceWithTimeMatch) {
    const command = attendanceWithTimeMatch[1].toLowerCase();

    return {
      action: LOGIN_MESSAGES.has(command) ? 'login' : 'logout',
      timestampOverride: parseDhakaTimeForToday(attendanceWithTimeMatch[2])
    };
  }

  if (LOGIN_MESSAGES.has(normalizedContent)) {
    return {
      action: 'login',
      timestampOverride: null
    };
  }

  if (LOGOUT_MESSAGES.has(normalizedContent)) {
    return {
      action: 'logout',
      timestampOverride: null
    };
  }

  return {
    action: null,
    timestampOverride: null
  };
};
