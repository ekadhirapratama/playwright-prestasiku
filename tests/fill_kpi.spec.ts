/**
 * Isi form KPI (mutasi): tambah KPI Non Reguler bila tabel kosong, isi target, lalu snapshot penilaian.
 * Host: `SMOKE_BASE_URL` (default Beta). Daftar NIPP: `NIPP_FILL_LIST`.
 * Mode kedua (hanya isi target, tidak menambah KPI): set `RUN_FILL_TARGETS_ONLY=1`.
 * Jumlah KPI ditambah jika kosong: `KPI_FILL_ADD_COUNT` (default 4, max 20).
 * Output JSON: `reports/kpi-fill-<iso>.json` atau path `KPI_FILL_OUT`.
 */
import { test, expect } from '@playwright/test';
import {
  getKpiBaseUrl,
  parseNippList,
  gotoNipp,
  closeSwal,
  openPerencanaanPribadiFromMenu,
  openPenilaianPribadiFromMenu,
  clickPenilaianBadgeIfPresent,
  scrapePenilaianTable,
  penilaianToShort,
  writeKpiFillBatch,
  type KpiFillRecord,
  type KpiFillBatch,
} from './helpers/prestasiku';

const BASE = getKpiBaseUrl();
const NIPPS = parseNippList('NIPP_FILL_LIST');

function addCount(): number {
  const n = parseInt(process.env.KPI_FILL_ADD_COUNT ?? '4', 10);
  if (Number.isNaN(n)) return 4;
  return Math.min(20, Math.max(1, n));
}

async function runFillKpi(
  page: import('@playwright/test').Page,
  nipp: string,
  mode: 'add-if-empty' | 'targets-only',
): Promise<KpiFillRecord> {
  const scrapedAt = new Date().toISOString();
  const result: KpiFillRecord = {
    nipp,
    status: 'success',
    mode,
    addedKPIs: [],
    penilaian: [],
    scrapedAt,
  };

  await gotoNipp(page, BASE, nipp);
  await openPerencanaanPribadiFromMenu(page);

  await expect(page.locator('.alert')).not.toContainText('Memuat data role', {
    timeout: 30_000,
  });
  await page.waitForTimeout(2000);
  await closeSwal(page);

  const rows = page.locator('table.table-bordered tbody tr');
  const count = await rows.count();
  const rowText = count > 0 ? await rows.first().innerText() : '';
  const looksEmpty =
    count === 0 || rowText.includes('No data') || rowText.includes('Batas KPI');

  if (mode === 'targets-only' && looksEmpty) {
    result.status = 'skipped: no KPI rows (targets-only mode)';
    return result;
  }

  if (mode === 'add-if-empty' && looksEmpty) {
    const nAdd = addCount();
    for (let i = 0; i < nAdd; i++) {
      await page.click('button:has-text("KPI Non Reguler")');
      await page.waitForSelector('.modal-content');

      await page.fill('input[placeholder*="Nama KPI"]', `KPI-Non-Reg-${i + 1}`);
      await page.fill('textarea[placeholder*="Definisi"]', `Definisi KPI ${i + 1}`);

      await page.click('.v-select:has-text("Pilih Formula")');
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await page.click('.v-select:has-text("Pilih Satuan")');
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await page.click('button:has-text("Simpan")');
      await page.waitForTimeout(2000);
      await closeSwal(page);
      result.addedKPIs.push(`KPI-Non-Reg-${i + 1}`);
    }
  }

  await page.click('button:has-text("Selanjutnya")');
  await page.waitForLoadState('load');
  await closeSwal(page);

  const editButtons = page.locator('button:has(.ki-pencil)');
  const editCount = await editButtons.count();

  if (mode === 'targets-only') {
    expect.soft(
      editCount,
      `NIPP ${nipp}: expected existing KPI rows to edit in targets-only mode`,
    ).toBeGreaterThan(0);
  }

  for (let i = 0; i < editCount; i++) {
    await editButtons.nth(i).click();
    await page.waitForSelector('.modal-content');

    await page.fill('input[placeholder*="1 Tahun"]', '100');
    await page.fill('input[placeholder*="SMT 1"]', '50');
    await page.fill('input[placeholder*="SMT 2"]', '50');

    await page.click('.v-select:has-text("Pilih Prioritas")');
    await page.waitForTimeout(500);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.click('button:has-text("Simpan")');
    await page.waitForTimeout(1000);
    await closeSwal(page);
  }

  await page.click('button:has-text("Selanjutnya")');
  await page.waitForLoadState('load');

  await openPenilaianPribadiFromMenu(page);
  await clickPenilaianBadgeIfPresent(page);

  await expect(
    page.getByRole('heading', { name: /Pengajuan Penilaian Kinerja/i }).first(),
  ).toBeVisible({ timeout: 25_000 });

  const fullPen = await scrapePenilaianTable(page);
  result.penilaian = penilaianToShort(fullPen);

  expect.soft(result.penilaian.length).toBeGreaterThan(0);

  return result;
}

test.describe('Fill KPI — tambah KPI jika kosong, lalu isi target', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 });

  const records: KpiFillRecord[] = [];

  test.afterAll(() => {
    if (records.length === 0) return;
    const batch: KpiFillBatch = {
      scrapedAt: new Date().toISOString(),
      host: BASE,
      records,
    };
    const file = writeKpiFillBatch(batch);
    // eslint-disable-next-line no-console
    console.log(`[fill_kpi] wrote ${records.length} record(s) → ${file}`);
  });

  for (const nipp of NIPPS) {
    test(`add-if-empty — NIPP ${nipp}`, async ({ page }) => {
      let rec: KpiFillRecord;
      try {
        rec = await runFillKpi(page, nipp, 'add-if-empty');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        rec = {
          nipp,
          status: `Error: ${msg}`,
          mode: 'add-if-empty',
          addedKPIs: [],
          penilaian: [],
          scrapedAt: new Date().toISOString(),
        };
        records.push(rec);
        throw e;
      }
      records.push(rec);
      if (rec.status !== 'success') {
        throw new Error(rec.status);
      }
    });
  }
});

if (process.env.RUN_FILL_TARGETS_ONLY === '1') {
  test.describe('Fill KPI — hanya isi target (tanpa tambah KPI)', () => {
    test.describe.configure({ mode: 'serial', timeout: 600_000 });

    const records: KpiFillRecord[] = [];

    test.afterAll(() => {
      if (records.length === 0) return;
      const batch: KpiFillBatch = {
        scrapedAt: new Date().toISOString(),
        host: BASE,
        records,
      };
      const file = writeKpiFillBatch(batch);
      // eslint-disable-next-line no-console
      console.log(`[fill_kpi targets-only] wrote ${records.length} record(s) → ${file}`);
    });

    for (const nipp of NIPPS) {
      test(`targets-only — NIPP ${nipp}`, async ({ page }) => {
        let rec: KpiFillRecord;
        try {
          rec = await runFillKpi(page, nipp, 'targets-only');
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          rec = {
            nipp,
            status: `Error: ${msg}`,
            mode: 'targets-only',
            addedKPIs: [],
            penilaian: [],
            scrapedAt: new Date().toISOString(),
          };
          records.push(rec);
          throw e;
        }
        records.push(rec);
        if (rec.status.startsWith('Error')) {
          throw new Error(rec.status);
        }
      });
    }
  });
}
