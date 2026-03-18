import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface TestCase {
  'tc-id': string; // format epic code + user story code + index '001'
  'jira-id'?: string;
  'sprint'?: string;
  'epic-modul'?: string;
  'user-story'?: string;
  'judul-test-case': string;
  'tipe'?: string;
  'priority'?: string;
  'precondition'?: string;
  'test-steps': string;
  'expected-result': string;
  'actual-result'?: string;
  'status'?: string; // not ready, ready to test(only if status-fe and status-be is done), pass, fail, blocked
  'status-fe'?: string; // todo, on progress slicing, done slicing, on progress integrasi, done integrasi, blocking
  'status-be'?: string; // todo, on progress, done, blocking
  'platform'?: string;
  'tested-by'?: string;
  'tested-date'?: string;
  'bug-report-link'?: string;
  'notes'?: string;
  [key: string]: any;
}

export function readTestData(fileName: string, sheetName?: string): TestCase[] {
  const filePath = path.join(__dirname, '..', 'data', fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = xlsx.readFile(filePath);

  // If sheetName is not provided, default to the first sheet (useful for CSVs)
  const targetSheetName = sheetName || workbook.SheetNames[0];

  if (!workbook.SheetNames.includes(targetSheetName)) {
    throw new Error(`Sheet '${targetSheetName}' not found in file '${fileName}'. Available sheets: ${workbook.SheetNames.join(', ')}`);
  }

  const worksheet = workbook.Sheets[targetSheetName];
  // Parse rows with alphabet headers A, B, C, etc.
  const data = xlsx.utils.sheet_to_json<any>(worksheet, { header: "A", defval: "" });

  if (!data || data.length === 0) {
    throw new Error(`No data found in sheet '${sheetName}'.`);
  }

  // Filter out the header row
  const rows = data.filter(row => row.E && row.E !== 'TC ID');

  return rows.map((row, index) => {
    return {
      'jira-id': row.A,
      'sprint': row.B,
      'epic-modul': row.C,
      'user-story': row.D,
      'tc-id': row.E || `TC-${index + 1}`,
      'judul-test-case': row.F || 'No title provided',
      'tipe': row.G,
      'priority': row.H,
      'precondition': row.I || '',
      'test-steps': row.J || '',
      'expected-result': row.K || '',
      'actual-result': row.L,
      'status': row.M,
      'platform': row.N,
      'tested-by': row.O,
      'tested-date': row.P,
      'bug-report-link': row.Q,
      'notes': row.R,
    } as TestCase;
  });
}
