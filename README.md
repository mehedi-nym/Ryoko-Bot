# RYOKO Office Assistant

Production-ready Discord Attendance & Remote Workspace Management Bot for RYOKO.

Employees log in and out from Discord, voice movement is tracked for breaks, attendance is stored in SQLite, and completed attendance is synced to Google Sheets.

## Features

- Discord attendance workflow inside `#attendance`
- Login commands: `Logged In`, `logged in`, `login`, `Login`, `start`
- Backdated login support: `Logged In (09.20PM)` and `Logged In (09:20 PM)`
- Logout commands: `Logged Out`, `logged out`, `logout`, `Logout`, `finish`
- Backdated logout support: `Logged Out (06.30PM)` and `Logged Out (06:30 PM)`
- Private DM notifications instead of public attendance-channel replies
- Personal work summaries by DM: today, this week, and this month
- Duplicate login protection
- Logout-without-login protection
- Voice tracking for `Ryoko Desk` and `Common Room`
- Break timer only starts on `Ryoko Desk -> Common Room`
- Meeting Room and Collab Room movement does not start break time
- SQLite persistence for employees, active sessions, voice logs, and attendance
- Sessions survive bot restarts
- Google Sheets sync for Attendance, Voice Logs, Daily Summary, and employee worksheets
- Daily file logging in `/logs`
- Asia/Dhaka timezone formatting

## Requirements

- Node.js LTS, version 22 or newer
- A Discord bot application
- A Google Cloud service account with Google Sheets API access
- A Google Spreadsheet shared with the service account email

## Installation

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
ATTENDANCE_CHANNEL_ID=
RYOKO_DESK_CHANNEL_ID=
COMMON_ROOM_CHANNEL_ID=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_PATH=./google-service-account.json
TIMEZONE=Asia/Dhaka
```

## Create the Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create a new application named `RYOKO Office Assistant`.
3. Open **Bot** and create a bot user.
4. Copy the bot token into `DISCORD_TOKEN`.
5. Enable these privileged gateway intents:
   - Server Members Intent
   - Message Content Intent
6. Open **OAuth2 -> URL Generator**.
7. Select scopes:
   - `bot`
8. Select bot permissions:
   - View Channels
   - Send Messages
   - Read Message History
   - Connect
   - View Audit Log is optional
9. Invite the bot to your server.

## Get Discord IDs

Enable Discord Developer Mode:

1. Discord Settings -> Advanced -> Developer Mode.
2. Right-click the server and copy `GUILD_ID`.
3. Right-click the attendance text channel and copy `ATTENDANCE_CHANNEL_ID`.
4. Right-click the `Ryoko Desk` voice channel and copy `RYOKO_DESK_CHANNEL_ID`.
5. Right-click the `Common Room` voice channel and copy `COMMON_ROOM_CHANNEL_ID`.

## Connect Google Sheets

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable **Google Sheets API**.
4. Create a service account.
5. Create a JSON key for the service account.
6. Save the JSON file as `google-service-account.json` in the project root, or set `GOOGLE_SERVICE_ACCOUNT_PATH` to its path.
7. Create a Google Spreadsheet.
8. Copy the spreadsheet ID from the URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

9. Put that value in `GOOGLE_SHEET_ID`.
10. Share the spreadsheet with the service account email using Editor permission.

The bot automatically creates these sheets:

- `Attendance`
- `Voice Logs`
- `Daily Summary`
- One worksheet per employee

## Run Locally

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## Deploy on Railway

1. Push this project to GitHub.
2. Create a new Railway project from the GitHub repository.
3. Add environment variables from `.env.example` in Railway Variables.
4. Add the Google service account JSON:
   - Preferred: paste the JSON into a Railway variable and write it to a file during deployment with your own startup wrapper.
   - Simple option: commit a non-production placeholder only, then upload the real JSON through Railway volume or secure file handling.
5. Set `GOOGLE_SERVICE_ACCOUNT_PATH` to the deployed JSON path.
6. Set the start command:

```bash
npm start
```

7. Deploy and check Railway logs for `RYOKO bot is online`.

For persistent SQLite storage on Railway, attach a volume and set:

```env
DATABASE_PATH=/data/ryoko.sqlite
```

## Attendance Workflow

Employees send messages only in the configured attendance channel.

Login examples:

```text
Logged In
login
start
Logged In (09.20PM)
Logged In (09:20 PM)
```

Logout examples:

```text
Logged Out
logout
finish
Logged Out (06:30 PM)
```

Every other message is ignored.

On logout, the bot privately sends the employee:

- Login Time
- Logout Time
- Total Duration
- Break Duration
- Net Working Hours

Attendance confirmations and summaries are sent privately by DM. The bot does not post public attendance confirmations in the group channel.

## Voice Tracking Rules

- Joining `Ryoko Desk` logs a voice event.
- Moving `Ryoko Desk -> Common Room` starts a break.
- Moving `Common Room -> Ryoko Desk` ends the break.
- Moving to Meeting Room, Collab Room, or any other room does not start break time.
- Disconnecting while logged in is logged.
- Reconnecting is logged and the active session continues.

Employees receive private DM notifications when they join Ryoko Desk, start a break, return from break, disconnect, or reconnect.

## Work Summary Messages

Employees can DM the bot, or mention the bot, with questions like:

```text
today hours
this week worked
this month attendance
how much time did I work today
```

The bot replies privately with completed shifts, completed break time, completed working hours, and the current active session if one exists.

## Project Structure

```text
config/       Environment and constants
database/     SQLite connection, migrations, repositories
events/       Discord event registration
helpers/      Small helper functions
logs/         Runtime log files
services/     Attendance, voice, and Google Sheets services
utils/        Time and logger utilities
index.js      Application entry point
```

## SQLite Tables

- `employees`
- `sessions`
- `voice_logs`
- `attendance`

The `sessions` table stores active login sessions, accumulated break time, and any currently running break.

## Logging

Daily logs are written to:

```text
logs/YYYY-MM-DD.log
```

Important actions logged include:

- Login
- Logout
- Duplicate login
- Logout without login
- Break Started
- Break Ended
- Google Sheets Error
- SQLite Error
- Discord reconnect events

## Troubleshooting

### Bot does not respond to attendance messages

- Confirm `ATTENDANCE_CHANNEL_ID` is correct.
- Confirm Message Content Intent is enabled in Discord Developer Portal.
- Confirm the bot has permission to view and send messages in the channel.

### Voice breaks are not counted

- Confirm `RYOKO_DESK_CHANNEL_ID` and `COMMON_ROOM_CHANNEL_ID` are correct.
- Breaks only start when moving directly from Ryoko Desk to Common Room.
- Movement to Meeting Room or Collab Room is intentionally ignored for break timing.

### Google Sheets sync fails

- Confirm `GOOGLE_SERVICE_ACCOUNT_PATH` points to a valid JSON key file.
- Confirm the spreadsheet is shared with the service account email.
- Confirm Google Sheets API is enabled.
- Check `/logs` for `Google Sheets Error`.

### SQLite errors

- Confirm the process can write to the `database/` folder.
- On Railway, use a persistent volume and set `DATABASE_PATH`.
- Check `/logs` for `SQLite Error`.

## Extending the Bot

Add new Discord behavior in `events/`, keep business logic in `services/`, and keep database access in `database/repositories.js`. This keeps Discord-specific code separate from attendance, Google Sheets, and persistence logic.
