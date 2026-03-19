// Mapping index kolom (0-based) → field TestCase
export const COLUMN_INDEX = {
  NO: 0,
  EPIC_MODUL: 1,
  USER_STORY: 2,
  JUDUL_TEST_CASE: 3,
  TEST_STEPS: 4,
  KEBUTUHAN: 6,
  SPRINT: 7,
  PIC_BE: 14,
  STATUS_BE: 16,
  PIC_FE: 19,
  STATUS_FE: 21,
  PIC_QA: 24,
  STATUS_QA: 25,
  CATATAN_QA: 27,
} as const;

export function safeGet(row: string[], index: number): string {
  return (row[index] ?? '').toString().trim();
}
