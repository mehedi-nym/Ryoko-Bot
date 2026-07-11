import dotenv from 'dotenv';

dotenv.config();

const requiredVariables = [
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'GUILD_ID',
  'ATTENDANCE_CHANNEL_ID',
  'RYOKO_DESK_CHANNEL_ID',
  'COMMON_ROOM_CHANNEL_ID',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_PATH'
];

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  attendanceChannelId: process.env.ATTENDANCE_CHANNEL_ID,
  ryokoDeskChannelId: process.env.RYOKO_DESK_CHANNEL_ID,
  commonRoomChannelId: process.env.COMMON_ROOM_CHANNEL_ID,
  googleSheetId: process.env.GOOGLE_SHEET_ID,
  googleServiceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
  timezone: process.env.TIMEZONE || 'Asia/Dhaka',
  databasePath: process.env.DATABASE_PATH || './database/ryoko.sqlite'
};

export const getMissingRequiredVariables = () => {
  return requiredVariables.filter((variableName) => !process.env[variableName]);
};
