import fs from 'fs/promises';
import { google } from 'googleapis';
import { config } from '../config/env.js';
import {
  ATTENDANCE_HEADERS,
  DAILY_SUMMARY_HEADERS,
  SHEET_NAMES,
  VOICE_LOG_HEADERS
} from '../config/constants.js';
import { createEmployeeSheetName } from '../helpers/sheetName.js';
import { formatDate, formatDateTime, formatDuration, formatTime } from '../utils/time.js';
import { logger } from '../utils/logger.js';

let sheetsClient;
let spreadsheetMetadata;
let metadataPromise = null;

// De-dupe concurrent ensureSheet() calls for the same title so two callers
// (e.g. initializeGoogleSheets() racing with saveAttendanceToSheets()) never
// issue two addSheet requests for the same sheet at the same time.
const ensureSheetPromises = new Map();

const getSheetsClient = async () => {
  if (sheetsClient) {
    return sheetsClient;
  }

  try {
    await fs.access(config.googleServiceAccountPath);

    const auth = new google.auth.GoogleAuth({
      keyFile: config.googleServiceAccountPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
  } catch (error) {
    console.error("=== GOOGLE SHEETS ERROR ===");
    console.error(error);

    await logger.error('Google Sheets Error', {
      path: config.googleServiceAccountPath,
      error: error.message,
      stack: error.stack
    });

    throw error;
  }
};

// Requirement 1: avoid repeated spreadsheets.get() calls.
// - Cached result is reused until a forceRefresh is requested.
// - Concurrent callers share a single in-flight request instead of firing
//   multiple GETs.
// - Only sheet titles are requested (fields filter) to keep the payload small.
const loadSpreadsheetMetadata = async (forceRefresh = false) => {
  if (spreadsheetMetadata && !forceRefresh) {
    return spreadsheetMetadata;
  }

  if (metadataPromise && !forceRefresh) {
    return metadataPromise;
  }

  const sheets = await getSheetsClient();

  metadataPromise = sheets.spreadsheets
    .get({
      spreadsheetId: config.googleSheetId,
      fields: 'sheets.properties.title'
    })
    .then((response) => {
      spreadsheetMetadata = response.data;
      return spreadsheetMetadata;
    })
    .finally(() => {
      metadataPromise = null;
    });

  return metadataPromise;
};

const getExistingSheetTitles = async (forceRefresh = false) => {
  const metadata = await loadSpreadsheetMetadata(forceRefresh);
  return new Set(metadata.sheets.map((sheet) => sheet.properties.title));
};

// Requirement 4: treat "already exists" as success, not failure.
const isAlreadyExistsError = (error) => {
  const message = error?.errors?.[0]?.message || error?.message || '';
  return message.toLowerCase().includes('already exists');
};

/**
 * Creates the sheet if it's missing.
 * Returns a status string so callers can log what actually happened:
 * 'created' | 'exists' | 'error'
 */
const createSheetIfMissing = async (title) => {
  const sheets = await getSheetsClient();
  const existingTitles = await getExistingSheetTitles();

  if (existingTitles.has(title)) {
    return 'exists';
  }

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.googleSheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title }
            }
          }
        ]
      }
    });

    // Requirement 2: refresh cached metadata after any sheet creation so
    // subsequent ensureSheet() calls (for other sheets) see it immediately.
    await loadSpreadsheetMetadata(true);
    return 'created';
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      // Someone else created it between our check and our request (e.g. a
      // concurrent process, or a manual edit). Refresh our view and treat
      // it as a successful no-op rather than crashing startup.
      await loadSpreadsheetMetadata(true);
      return 'exists';
    }

    throw error;
  }
};

const ensureSheetHeaders = async (title, headers) => {
  const sheets = await getSheetsClient();

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range: `'${title}'!A1:Z1`
  });

  const currentHeaders = headerResponse.data.values?.[0] || [];

  if (currentHeaders.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetId,
      range: `'${title}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers]
      }
    });
  }
};

/**
 * Ensures a sheet exists and has headers.
 * Requirement 3: concurrent calls for the same title share one in-flight
 * promise instead of racing.
 * Resolves to the same status as createSheetIfMissing(): 'created' | 'exists'
 * (throws on unrecoverable errors, letting callers decide how to log/handle it).
 */
const ensureSheet = (title, headers) => {
  if (ensureSheetPromises.has(title)) {
    return ensureSheetPromises.get(title);
  }

  const promise = (async () => {
    const status = await createSheetIfMissing(title);
    await ensureSheetHeaders(title, headers);
    return status;
  })().finally(() => {
    ensureSheetPromises.delete(title);
  });

  ensureSheetPromises.set(title, promise);
  return promise;
};

const appendRow = async (sheetName, row) => {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row]
    }
  });
};

// Requirement 5: clear startup logging of created / already existed / failed.
export const initializeGoogleSheets = async () => {
  const targets = [
    { title: SHEET_NAMES.attendance, headers: ATTENDANCE_HEADERS },
    { title: SHEET_NAMES.voiceLogs, headers: VOICE_LOG_HEADERS },
    { title: SHEET_NAMES.dailySummary, headers: DAILY_SUMMARY_HEADERS }
  ];

  const created = [];
  const alreadyExisted = [];
  const failed = [];

  for (const { title, headers } of targets) {
    try {
      const status = await ensureSheet(title, headers);
      if (status === 'created') {
        created.push(title);
      } else {
        alreadyExisted.push(title);
      }
    } catch (error) {
      failed.push(title);
      await logger.error('Google Sheets Error: failed to initialize sheet', {
        sheet: title,
        error: error.message
      });
    }
  }

  await logger.info('Google Sheets initialization summary', {
    created,
    alreadyExisted,
    failed
  });

  if (failed.length > 0) {
    throw new Error(`Failed to initialize sheet(s): ${failed.join(', ')}`);
  }

  await logger.info('Google Sheets initialized');
};

export const saveAttendanceToSheets = async (attendanceRecord) => {
  const employeeSheetName = createEmployeeSheetName(attendanceRecord.username, attendanceRecord.discordId);
  const attendanceRow = [
    formatDate(attendanceRecord.logoutAt),
    attendanceRecord.username,
    attendanceRecord.discordId,
    formatTime(attendanceRecord.loginAt),
    formatTime(attendanceRecord.logoutAt),
    formatDuration(attendanceRecord.breakMs),
    formatDuration(attendanceRecord.workingMs)
  ];

  try {
    await ensureSheet(SHEET_NAMES.attendance, ATTENDANCE_HEADERS);
    await ensureSheet(employeeSheetName, ATTENDANCE_HEADERS);
    await ensureSheet(SHEET_NAMES.dailySummary, DAILY_SUMMARY_HEADERS);

    await appendRow(SHEET_NAMES.attendance, attendanceRow);
    await appendRow(employeeSheetName, attendanceRow);
    await appendRow(SHEET_NAMES.dailySummary, [
      formatDate(attendanceRecord.logoutAt),
      attendanceRecord.username,
      attendanceRecord.discordId,
      formatDuration(attendanceRecord.breakMs),
      formatDuration(attendanceRecord.workingMs)
    ]);
  } catch (error) {
    await logger.error('Google Sheets Error: failed to save attendance', {
      discordId: attendanceRecord.discordId,
      error: error.message
    });
    throw error;
  }
};

export const saveVoiceLogToSheets = async ({ timestamp, username, action }) => {
  try {
    await ensureSheet(SHEET_NAMES.voiceLogs, VOICE_LOG_HEADERS);
    await appendRow(SHEET_NAMES.voiceLogs, [formatDateTime(timestamp), username, action]);
  } catch (error) {
    await logger.error('Google Sheets Error: failed to save voice log', { username, action, error: error.message });
  }
};