export const parseWorkSummaryRequest = (content) => {
  const normalizedContent = content.trim().toLowerCase();

  if (!normalizedContent) {
    return null;
  }

  const asksForWorkTime =
    normalizedContent.includes('worked') ||
    normalizedContent.includes('work time') ||
    normalizedContent.includes('working time') ||
    normalizedContent.includes('hours') ||
    normalizedContent.includes('attendance') ||
    normalizedContent.includes('summary');

  if (!asksForWorkTime) {
    return null;
  }

  if (normalizedContent.includes('month')) {
    return 'month';
  }

  if (normalizedContent.includes('week')) {
    return 'week';
  }

  return 'today';
};
