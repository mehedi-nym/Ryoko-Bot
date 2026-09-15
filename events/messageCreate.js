import { handleAttendanceMessage } from '../services/attendanceService.js';
import { handleWorkSummaryMessage } from '../services/workSummaryService.js';
import { handleKeepAliveAdminCommand } from '../services/keepAliveService.js';

export const registerMessageCreateEvent = (client, appConfig) => {
  client.on('messageCreate', async (message) => {
    const handledKeepAliveCommand = await handleKeepAliveAdminCommand(message);

    if (handledKeepAliveCommand) {
      return;
    }

    const handledSummary = await handleWorkSummaryMessage(message, client);

    if (handledSummary) {
      return;
    }

    await handleAttendanceMessage(message, appConfig);
  });
};
