export const LOGIN_MESSAGES = new Set(['logged in', 'login', 'start']);
export const LOGOUT_MESSAGES = new Set(['logged out', 'logout', 'finish']);

export const SHEET_NAMES = {
  attendance: 'Attendance',
  voiceLogs: 'Voice Logs',
  dailySummary: 'Daily Summary'
};

export const ATTENDANCE_HEADERS = [
  'Date',
  'Employee Name',
  'Discord ID',
  'Login',
  'Logout',
  'Break',
  'Working Hours'
];

export const VOICE_LOG_HEADERS = ['Timestamp', 'Employee', 'Action'];

export const DAILY_SUMMARY_HEADERS = [
  'Date',
  'Employee Name',
  'Discord ID',
  'Total Break',
  'Working Hours'
];
