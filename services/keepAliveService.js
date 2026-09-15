import { addKeepAliveSite, readKeepAliveSites, removeKeepAliveSite, updateKeepAliveSite } from './keepAliveStorageService.js';
import { sendDirectMessage } from '../helpers/directMessage.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let schedulerStarted = false;
let schedulerRunning = false;
let schedulerTimer = null;

const keepAliveUserAgent = 'RYOKO-KeepAlive/1.0 (+https://ryoko.local)';

const wait = async (milliseconds) => {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const isValidSiteName = (name) => /^[a-zA-Z0-9_-]{1,40}$/.test(name);

const normalizeUrl = (urlText) => {
  try {
    const url = new URL(urlText);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const requestUrl = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.keepAliveTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': keepAliveUserAgent,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.5'
      }
    });

    await response.body?.cancel();

    return {
      ok: response.ok,
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
};

const checkSite = async (site) => {
  const checkedAt = new Date().toISOString();

  try {
    const mainResult = await requestUrl(site.url);
    let heartbeatResult = null;

    if (site.heartbeatUrl) {
      await wait(750);
      heartbeatResult = await requestUrl(site.heartbeatUrl);
    }

    const success = mainResult.ok && (!heartbeatResult || heartbeatResult.ok);

    await updateKeepAliveSite(site.name, {
      lastChecked: checkedAt,
      lastSuccess: success ? checkedAt : site.lastSuccess || null,
      failureCount: success ? 0 : Number(site.failureCount || 0) + 1,
      lastError: success
        ? null
        : `HTTP ${heartbeatResult?.status || mainResult.status}`
    });

    return success;
  } catch (error) {
    await updateKeepAliveSite(site.name, {
      lastChecked: checkedAt,
      failureCount: Number(site.failureCount || 0) + 1,
      lastError: error.name === 'AbortError' ? 'Request timeout' : error.message
    });

    return false;
  }
};

const notifyAdminIfNeeded = async (client, site) => {
  if (!config.discordAdminId) {
    return;
  }

  const failureCount = Number(site.failureCount || 0);

  if (failureCount < 3 || Number(site.lastNotifiedFailureCount || 0) >= failureCount) {
    return;
  }

  try {
    const adminUser = await client.users.fetch(config.discordAdminId);
    await sendDirectMessage(
      adminUser,
      [
        'Keep-alive warning:',
        `${site.name} has failed ${failureCount} checks in a row.`,
        `Last error: ${site.lastError || 'Unknown error'}`
      ].join('\n')
    );
    await updateKeepAliveSite(site.name, { lastNotifiedFailureCount: failureCount });
  } catch (error) {
    await logger.warn('Keep-alive admin notification failed', { error: error.message });
  }
};

export const runKeepAliveChecks = async (client) => {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    const sites = await readKeepAliveSites();
    const enabledSites = sites.filter((site) => site.enabled);

    for (const site of enabledSites) {
      await checkSite(site);
      const updatedSite = (await readKeepAliveSites()).find((item) => item.name.toLowerCase() === site.name.toLowerCase());

      if (updatedSite) {
        await notifyAdminIfNeeded(client, updatedSite);
      }

      await wait(config.keepAliveRequestDelayMs);
    }
  } catch (error) {
    await logger.error('Keep-alive scheduler error', { error: error.message });
  } finally {
    schedulerRunning = false;
  }
};

export const startKeepAliveScheduler = (client) => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  const scheduleNextRun = (delayMs = config.keepAliveIntervalMs) => {
    schedulerTimer = setTimeout(async () => {
      await runKeepAliveChecks(client);
      scheduleNextRun();
    }, delayMs);
  };

  scheduleNextRun(config.keepAliveInitialDelayMs);
  void logger.info('Keep-alive scheduler started');
};

export const stopKeepAliveScheduler = () => {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
  }
};

export const handleKeepAliveAdminCommand = async (message) => {
  if (message.author.bot || !message.content.startsWith('!')) {
    return false;
  }

  const [command, ...args] = message.content.trim().split(/\s+/);
  const normalizedCommand = command.toLowerCase();
  const adminCommands = new Set(['!addsite', '!removesite', '!mysites']);

  if (!adminCommands.has(normalizedCommand)) {
    return false;
  }

  if (!config.discordAdminId || message.author.id !== config.discordAdminId) {
    await message.reply('Permission denied.');
    return true;
  }

  if (message.inGuild() && message.deletable) {
    await message.delete().catch(() => {});
  }

  if (normalizedCommand === '!mysites') {
    const sites = await readKeepAliveSites();
    const lines = sites.length
      ? sites.flatMap((site, index) => [
          `${index + 1}. ${site.name}`,
          `   ${site.url}`,
          `   heartbeat: ${site.heartbeatUrl ? 'configured' : 'not configured'}`,
          `   last checked: ${site.lastChecked || 'never'}`,
          `   last success: ${site.lastSuccess || 'never'}`
        ])
      : ['No sites registered.'];

    await sendDirectMessage(message.author, ['My Sites', ...lines].join('\n'));
    return true;
  }

  if (normalizedCommand === '!addsite') {
    const [name, urlText, heartbeatUrlText] = args;

    if (!name || !urlText || !isValidSiteName(name)) {
      await sendDirectMessage(message.author, 'Usage: !addsite <name> <url> [heartbeatUrl]');
      return true;
    }

    const url = normalizeUrl(urlText);
    const heartbeatUrl = heartbeatUrlText ? normalizeUrl(heartbeatUrlText) : null;

    if (!url || (heartbeatUrlText && !heartbeatUrl)) {
      await sendDirectMessage(message.author, 'Invalid URL. Only http/https URLs are allowed.');
      return true;
    }

    await addKeepAliveSite({ name, url, heartbeatUrl });
    await sendDirectMessage(message.author, `Site saved: ${name}`);
    return true;
  }

  if (normalizedCommand === '!removesite') {
    const [name] = args;

    if (!name) {
      await sendDirectMessage(message.author, 'Usage: !removesite <name>');
      return true;
    }

    const removed = await removeKeepAliveSite(name);
    await sendDirectMessage(message.author, removed ? `Site removed: ${name}` : `Site not found: ${name}`);
    return true;
  }

  return false;
};
