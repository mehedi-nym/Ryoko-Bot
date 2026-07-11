import { getDatabase } from './connection.js';
import { logger } from '../utils/logger.js';
import { toIso } from '../utils/time.js';

export const upsertEmployee = async ({ discordId, username }) => {
  try {
    const db = await getDatabase();
    const timestamp = toIso(new Date());

    await db.run(
      `
      INSERT INTO employees (discord_id, username, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        username = excluded.username,
        updated_at = excluded.updated_at
      `,
      [discordId, username, timestamp, timestamp]
    );
  } catch (error) {
    await logger.error('SQLite Error: failed to upsert employee', { discordId, error: error.message });
    throw error;
  }
};

export const getActiveSession = async (discordId) => {
  try {
    const db = await getDatabase();
    return db.get('SELECT * FROM sessions WHERE discord_id = ?', [discordId]);
  } catch (error) {
    await logger.error('SQLite Error: failed to fetch active session', { discordId, error: error.message });
    throw error;
  }
};

export const createSession = async ({ discordId, username, loginAt }) => {
  try {
    const db = await getDatabase();
    const timestamp = toIso(new Date());

    await db.run(
      `
      INSERT INTO sessions (discord_id, username, login_at, total_break_ms, break_started_at, created_at, updated_at)
      VALUES (?, ?, ?, 0, NULL, ?, ?)
      `,
      [discordId, username, loginAt, timestamp, timestamp]
    );
  } catch (error) {
    await logger.error('SQLite Error: failed to create session', { discordId, error: error.message });
    throw error;
  }
};

export const updateSessionBreakStart = async ({ discordId, breakStartedAt }) => {
  try {
    const db = await getDatabase();
    await db.run(
      'UPDATE sessions SET break_started_at = ?, updated_at = ? WHERE discord_id = ?',
      [breakStartedAt, toIso(new Date()), discordId]
    );
  } catch (error) {
    await logger.error('SQLite Error: failed to start break', { discordId, error: error.message });
    throw error;
  }
};

export const updateSessionBreakEnd = async ({ discordId, totalBreakMs }) => {
  try {
    const db = await getDatabase();
    await db.run(
      'UPDATE sessions SET total_break_ms = ?, break_started_at = NULL, updated_at = ? WHERE discord_id = ?',
      [totalBreakMs, toIso(new Date()), discordId]
    );
  } catch (error) {
    await logger.error('SQLite Error: failed to end break', { discordId, error: error.message });
    throw error;
  }
};

export const deleteSession = async (discordId) => {
  try {
    const db = await getDatabase();
    await db.run('DELETE FROM sessions WHERE discord_id = ?', [discordId]);
  } catch (error) {
    await logger.error('SQLite Error: failed to delete session', { discordId, error: error.message });
    throw error;
  }
};

export const createAttendanceRecord = async ({ discordId, username, loginAt, logoutAt, breakMs, workingMs }) => {
  try {
    const db = await getDatabase();
    const result = await db.run(
      `
      INSERT INTO attendance (discord_id, username, login_at, logout_at, break_ms, working_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [discordId, username, loginAt, logoutAt, breakMs, workingMs, toIso(new Date())]
    );

    return result.lastID;
  } catch (error) {
    await logger.error('SQLite Error: failed to create attendance record', { discordId, error: error.message });
    throw error;
  }
};

export const getAttendanceRecordsSince = async ({ discordId, since }) => {
  try {
    const db = await getDatabase();
    return db.all(
      `
      SELECT *
      FROM attendance
      WHERE discord_id = ?
        AND logout_at >= ?
      ORDER BY logout_at ASC
      `,
      [discordId, since]
    );
  } catch (error) {
    await logger.error('SQLite Error: failed to fetch attendance summary', {
      discordId,
      since,
      error: error.message
    });
    throw error;
  }
};

export const createVoiceLog = async ({ discordId, username, action, channelId, timestamp }) => {
  try {
    const db = await getDatabase();
    await db.run(
      `
      INSERT INTO voice_logs (discord_id, username, action, channel_id, timestamp)
      VALUES (?, ?, ?, ?, ?)
      `,
      [discordId, username, action, channelId || null, timestamp]
    );
  } catch (error) {
    await logger.error('SQLite Error: failed to create voice log', { discordId, action, error: error.message });
    throw error;
  }
};
