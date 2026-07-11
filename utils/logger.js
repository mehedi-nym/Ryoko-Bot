import fs from 'fs/promises';
import path from 'path';
import { formatDateTime, now } from './time.js';

const logDirectory = path.resolve('logs');

const writeLog = async (level, message, meta = {}) => {
  await fs.mkdir(logDirectory, { recursive: true });

  const date = now().format('YYYY-MM-DD');
  const filePath = path.join(logDirectory, `${date}.log`);
  const metaText = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${formatDateTime(now().toISOString())}] [${level}] ${message}${metaText}\n`;

  await fs.appendFile(filePath, line, 'utf8');
};

export const logger = {
  info: async (message, meta) => writeLog('INFO', message, meta),
  warn: async (message, meta) => writeLog('WARN', message, meta),
  error: async (message, meta) => writeLog('ERROR', message, meta)
};
