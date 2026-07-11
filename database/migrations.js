import { getDatabase } from './connection.js';
import { logger } from '../utils/logger.js';

export const initializeDatabase = async () => {
  try {
    const db = await getDatabase();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        discord_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        discord_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        login_at TEXT NOT NULL,
        total_break_ms INTEGER NOT NULL DEFAULT 0,
        break_started_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (discord_id) REFERENCES employees(discord_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS voice_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        channel_id TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        login_at TEXT NOT NULL,
        logout_at TEXT NOT NULL,
        break_ms INTEGER NOT NULL,
        working_ms INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_voice_logs_discord_id ON voice_logs(discord_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_discord_id ON attendance(discord_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_logout_at ON attendance(logout_at);
    `);

    await logger.info('SQLite database initialized');
  } catch (error) {
    await logger.error('SQLite Error: failed to initialize database', { error: error.message });
    throw error;
  }
};
