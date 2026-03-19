export const SPREADSHEET_CONFIG = {
  spreadsheetId: process.env.SPREADSHEET_ID ?? '',
  sheetName: process.env.SHEET_NAME ?? 'Sprint [Web]',
  dataStartRow: parseInt(process.env.DATA_START_ROW ?? '5', 10),
  getRange: (sheetName: string) => `'${sheetName}'!A5:AH`,
};
