import { google } from 'googleapis';
import { getAuthClient } from './google-auth';
import { SPREADSHEET_CONFIG } from '../config/spreadsheet.config';
import { COLUMN_INDEX, safeGet } from './column-mapper';
import { generateTcId } from './tc-id-generator';
import { TestCase } from './file-reader';

export async function readSpreadsheet(): Promise<TestCase[]> {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const { spreadsheetId, sheetName } = SPREADSHEET_CONFIG;
  const range = SPREADSHEET_CONFIG.getRange(sheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const rows: string[][] = (response.data.values ?? []) as string[][];

  const testCases: TestCase[] = [];

  let lastEpic = '';
  let lastUserStory = '';
  let lastSprint = '';
  const epicIndexMap: Record<string, number> = {};

  for (const row of rows) {
    const descTask = safeGet(row, COLUMN_INDEX.JUDUL_TEST_CASE);
    if (!descTask) continue;

    const epicRaw = safeGet(row, COLUMN_INDEX.EPIC_MODUL) || lastEpic;
    const storyRaw = safeGet(row, COLUMN_INDEX.USER_STORY) || lastUserStory;
    const sprintRaw = safeGet(row, COLUMN_INDEX.SPRINT) || lastSprint;
    lastEpic = epicRaw;
    lastUserStory = storyRaw;
    lastSprint = sprintRaw;

    const mapKey = `${epicRaw}__${storyRaw}`;
    epicIndexMap[mapKey] = (epicIndexMap[mapKey] ?? 0) + 1;
    const tcId = generateTcId(epicRaw, storyRaw, epicIndexMap[mapKey]);

    const rawStatusQA = safeGet(row, COLUMN_INDEX.STATUS_QA).toLowerCase();
    const rawStatusFE = safeGet(row, COLUMN_INDEX.STATUS_FE).toLowerCase();
    const rawStatusBE = safeGet(row, COLUMN_INDEX.STATUS_BE).toLowerCase();

    const testCase: TestCase = {
      'tc-id': tcId,
      'sprint': sprintRaw || undefined,
      'epic-modul': epicRaw || undefined,
      'user-story': storyRaw || undefined,
      'judul-test-case': descTask,
      'test-steps': safeGet(row, COLUMN_INDEX.TEST_STEPS),
      'expected-result': 'Sesuai Acceptance Criteria',
      'notes': safeGet(row, COLUMN_INDEX.KEBUTUHAN) || undefined,
      'status': normalizeStatusQA(rawStatusQA) || undefined,
      'status-fe': rawStatusFE || undefined,
      'status-be': rawStatusBE || undefined,
      'tested-by': safeGet(row, COLUMN_INDEX.PIC_QA) || undefined,
      'jira-id': undefined,
      'tipe': undefined,
      'priority': undefined,
      'precondition': undefined,
      'actual-result': undefined,
      'platform': undefined,
      'tested-date': undefined,
      'bug-report-link': undefined,
    };

    testCases.push(testCase);
  }

  return testCases;
}

function normalizeStatusQA(raw: string): TestCase['status'] {
  if (!raw) return undefined;
  if (raw.includes('pass')) return 'pass';
  if (raw.includes('fail')) return 'fail';
  if (raw.includes('block')) return 'blocked';
  if (raw.includes('ready to test')) return 'ready to test';
  return 'not ready';
}
