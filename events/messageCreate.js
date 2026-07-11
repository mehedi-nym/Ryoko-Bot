import { handleAttendanceMessage } from '../services/attendanceService.js';
import { handleWorkSummaryMessage } from '../services/workSummaryService.js';

export const registerMessageCreateEvent = (client, appConfig) => {
  client.on('messageCreate', async (message) => {
    const handledSummary = await handleWorkSummaryMessage(message, client);

    if (handledSummary) {
      return;
    }

    await handleAttendanceMessage(message, appConfig);
  });
};
