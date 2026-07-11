import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let database;

export const getDatabase = async () => {
  if (database) {
    return database;
  }

  try {
    const databasePath = path.resolve(config.databasePath);
    await fs.mkdir(path.dirname(databasePath), { recursive: true });

    database = await open({
      filename: databasePath,
      driver: sqlite3.Database
    });

    await database.exec('PRAGMA foreign_keys = ON;');
    return database;
  } catch (error) {
    await logger.error('SQLite Error: failed to open database', { error: error.message });
    throw error;
  }
};
