/**
 * Scrape tabel Perencanaan + Penilaian (read-only). Host: `SMOKE_BASE_URL` (default Beta).
 * Daftar NIPP: `NIPP_SCRAPE_LIST` (koma/spasi). Output: JSON batch ke `reports/kpi-scrape-<iso>.json`
 * atau path penuh `KPI_SCRAPE_OUT`.
 */
import { test } from '@playwright/test';
import {
  getKpiBaseUrl,
  parseNippList,
  gotoNipp,
  scrapeDisplayName,
  openPerencanaanPribadiFromMenu,
  openPenilaianPribadiFromMenu,
  clickPenilaianBadgeIfPresent,
  scrapePerencanaanTable,
  scrapePenilaianTable,
  writeKpiScrapeBatch,
  type KpiScrapeRecord,
  type KpiScrapeBatch,
} from './helpers/prestasiku';

const BASE = getKpiBaseUrl();
const NIPPS = parseNippList('NIPP_SCRAPE_LIST');

test.describe('Scrape KPI (serial batch → satu file JSON)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  const records: KpiScrapeRecord[] = [];

  test.afterAll(() => {
    const batch: KpiScrapeBatch = {
      scrapedAt: new Date().toISOString(),
      host: BASE,
      records,
    };
    const file = writeKpiScrapeBatch(batch);
    // eslint-disable-next-line no-console
    console.log(`[scrape_kpi] wrote ${records.length} record(s) → ${file}`);
  });

  for (const nipp of NIPPS) {
    test(`KPI data for NIPP ${nipp}`, async ({ page }) => {
      const scrapedAt = new Date().toISOString();
      const result: KpiScrapeRecord = {
        nipp,
        name: '',
        status: 'success',
        perencanaan: [],
        penilaian: [],
        scrapedAt,
      };

      try {
        await gotoNipp(page, BASE, nipp);
        result.name = await scrapeDisplayName(page);

        const menuP = page.locator('.menu-link.menu-toggle:has-text("Perencanaan Kinerja")');
        if (await menuP.isVisible({ timeout: 10_000 }).catch(() => false)) {
          await openPerencanaanPribadiFromMenu(page);
          result.perencanaan = await scrapePerencanaanTable(page);
        }

        const menuPen = page.locator(
          '.menu-link.menu-toggle:has-text("Pengajuan Penilaian Kerja")',
        );
        if (await menuPen.isVisible({ timeout: 10_000 }).catch(() => false)) {
          await openPenilaianPribadiFromMenu(page);
          await clickPenilaianBadgeIfPresent(page);
          result.penilaian = await scrapePenilaianTable(page);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        result.status = `Error: ${msg}`;
      } finally {
        records.push(result);
      }
    });
  }
});
