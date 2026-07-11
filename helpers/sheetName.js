export const createEmployeeSheetName = (employeeName, discordId) => {
  const safeName = employeeName
    .replace(/[\[\]\*\?\/\\:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18);

  return `${safeName || 'Employee'}-${discordId.slice(-6)}`.slice(0, 31);
};
