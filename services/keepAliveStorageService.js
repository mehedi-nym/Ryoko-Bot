import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';

const getStoragePath = () => path.resolve(config.keepAliveStoragePath);

const ensureStorageFile = async () => {
  const storagePath = getStoragePath();
  await fs.mkdir(path.dirname(storagePath), { recursive: true });

  try {
    await fs.access(storagePath);
  } catch {
    await fs.writeFile(storagePath, JSON.stringify({ sites: [] }, null, 2), 'utf8');
  }
};

export const readKeepAliveSites = async () => {
  await ensureStorageFile();

  const rawContent = await fs.readFile(getStoragePath(), 'utf8');
  const parsedContent = JSON.parse(rawContent || '{}');

  return Array.isArray(parsedContent.sites) ? parsedContent.sites : [];
};

const writeKeepAliveSites = async (sites) => {
  await ensureStorageFile();
  await fs.writeFile(getStoragePath(), JSON.stringify({ sites }, null, 2), 'utf8');
};

export const addKeepAliveSite = async ({ name, url, heartbeatUrl = null }) => {
  const sites = await readKeepAliveSites();
  const existingSite = sites.find((site) => site.name.toLowerCase() === name.toLowerCase());
  const timestamp = new Date().toISOString();

  const nextSite = {
    name,
    url,
    heartbeatUrl,
    enabled: true,
    lastChecked: null,
    lastSuccess: null,
    failureCount: 0,
    lastError: null,
    lastNotifiedFailureCount: 0,
    createdAt: existingSite?.createdAt || timestamp,
    updatedAt: timestamp
  };

  const nextSites = existingSite
    ? sites.map((site) => (site.name.toLowerCase() === name.toLowerCase() ? nextSite : site))
    : [...sites, nextSite];

  await writeKeepAliveSites(nextSites);
  return nextSite;
};

export const removeKeepAliveSite = async (name) => {
  const sites = await readKeepAliveSites();
  const nextSites = sites.filter((site) => site.name.toLowerCase() !== name.toLowerCase());

  if (nextSites.length === sites.length) {
    return false;
  }

  await writeKeepAliveSites(nextSites);
  return true;
};

export const updateKeepAliveSite = async (name, updates) => {
  const sites = await readKeepAliveSites();
  const nextSites = sites.map((site) => {
    if (site.name.toLowerCase() !== name.toLowerCase()) {
      return site;
    }

    return {
      ...site,
      ...updates,
      updatedAt: new Date().toISOString()
    };
  });

  await writeKeepAliveSites(nextSites);
};
