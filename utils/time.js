import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { config } from '../config/env.js';

dayjs.extend(duration);
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export const now = () => dayjs().tz(config.timezone);

export const fromIso = (isoTimestamp) => dayjs(isoTimestamp).tz(config.timezone);

export const toIso = (dateValue) => dayjs(dateValue).toISOString();

export const formatDate = (dateValue) => fromIso(toIso(dateValue)).format('DD MMM YYYY');

export const formatTime = (dateValue) => fromIso(toIso(dateValue)).format('hh:mm A');

export const formatDateTime = (dateValue) => fromIso(toIso(dateValue)).format('DD MMM YYYY hh:mm A');

export const formatDuration = (milliseconds) => {
  const safeMilliseconds = Math.max(0, Number(milliseconds) || 0);
  const totalMinutes = Math.floor(safeMilliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const parseDhakaTimeForToday = (timeText) => {
  const cleanedTime = timeText.replace(/\s+/g, '').replace(':', '.').toUpperCase();
  const today = now().format('YYYY-MM-DD');
  const parsed = dayjs.tz(`${today} ${cleanedTime}`, 'YYYY-MM-DD h.mmA', config.timezone);

  if (!parsed.isValid()) {
    return null;
  }

  const currentTime = now();
  const adjusted = parsed.isAfter(currentTime.add(5, 'minute')) ? parsed.subtract(1, 'day') : parsed;
  return adjusted.toISOString();
};

export const getPeriodStart = (period) => {
  if (period === 'today') {
    return now().startOf('day').toISOString();
  }

  if (period === 'week') {
    return now().startOf('week').toISOString();
  }

  if (period === 'month') {
    return now().startOf('month').toISOString();
  }

  return now().startOf('day').toISOString();
};
