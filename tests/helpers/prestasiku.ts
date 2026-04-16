import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';

/** Base URL untuk alur KPI (isi form / scrape). Default Beta; override dengan `SMOKE_BASE_URL`. */
export function getKpiBaseUrl(): string {
  return (
    process.env.SMOKE_BASE_URL?.replace(/\/$/, '') ??
    'https://prestasikukaigroup-beta.kai.id'
  );
}

const DEFAULT_NIPPS = [
  '40398',
  '43596',
  '40867',
  '40879',
  '40968',
  '40969',
] as const;

export function parseNippList(
  envVar: 'NIPP_FILL_LIST' | 'NIPP_SCRAPE_LIST',
  fallback: readonly string[] = DEFAULT_NIPPS,
): string[] {
  const raw = process.env[envVar];
  if (!raw?.trim()) return [...fallback];
  return raw.split(/[\s,]+/).filter(Boolean);
}

export async function closeSwal(page: Page): Promise<void> {
  const swalOk = page.locator('button.swal2-confirm');
  if (await swalOk.isVisible().catch(() => false)) {
    await swalOk.click();
    await page.waitForTimeout(400);
  }
}

export async function closeBlockingDialogs(page: Page): Promise<void> {
  await closeSwal(page);
  const tutup = page.getByRole('button', { name: /^Tutup$/i });
  if (await tutup.isVisible().catch(() => false)) {
    await tutup.click();
    await page.waitForTimeout(300);
  }
}

export async function gotoNipp(
  page: Page,
  base: string,
  nipp: string,
): Promise<void> {
  await page.goto(`${base}/nipp?nipp=${nipp}`, {
    waitUntil: 'load',
    timeout: 90_000,
  });
  await closeBlockingDialogs(page);
}

export async function openPerencanaanPribadiFromMenu(page: Page): Promise<void> {
  await page
    .locator('.menu-link.menu-toggle:has-text("Perencanaan Kinerja")')
    .first()
    .click();
  await page
    .locator('a[href*="/perencanaan-kinerja/pribadi"]')
    .first()
    .click();
  await page.waitForLoadState('networkidle').catch(() => page.waitForLoadState('load'));
  await closeSwal(page);
}

export async function openPenilaianPribadiFromMenu(page: Page): Promise<void> {
  await page
    .locator('.menu-link.menu-toggle:has-text("Pengajuan Penilaian Kerja")')
    .first()
    .click();
  await page
    .locator('a[href*="/penilaian-kinerja/pribadi"]')
    .first()
    .click();
  await page.waitForLoadState('networkidle').catch(() => page.waitForLoadState('load'));
  await closeSwal(page);
}

export async function clickPenilaianBadgeIfPresent(page: Page): Promise<void> {
  const btn = page.locator('button.btn-warning:has-text("Penilaian")').first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForLoadState('networkidle').catch(() => page.waitForLoadState('load'));
    await closeSwal(page);
  }
}

/** Baris tabel perencanaan (bukan header / placeholder). */
export type PerencanaanRow = {
  jenis: string;
  nama: string;
  formula: string;
  polaritas: string;
};

/** Baris tabel penilaian — kolom selaras tabel UI untuk paste ke Excel / formula manual. */
export type PenilaianRow = {
  nama: string;
  target1Th: string;
  targetSmt1: string;
  realisasiSmt1: string;
  sisaTarget: string;
  skor: string;
};

export type PenilaianRowShort = Pick<
  PenilaianRow,
  'nama' | 'target1Th' | 'skor'
>;

/** Satu entri hasil scrape multi-NIPP (array root = `KpiScrapeBatch.records`). */
export type KpiScrapeRecord = {
  nipp: string;
  name: string;
  status: string;
  perencanaan: PerencanaanRow[];
  penilaian: PenilaianRow[];
  scrapedAt: string;
};

export type KpiScrapeBatch = {
  scrapedAt: string;
  host: string;
  records: KpiScrapeRecord[];
};

export type KpiFillRecord = {
  nipp: string;
  status: string;
  mode: 'add-if-empty' | 'targets-only';
  addedKPIs: string[];
  penilaian: PenilaianRowShort[];
  scrapedAt: string;
};

export type KpiFillBatch = {
  scrapedAt: string;
  host: string;
  records: KpiFillRecord[];
};

export async function scrapeDisplayName(page: Page): Promise<string> {
  try {
    return (
      await page
        .locator('.flex-grow-1 > span.fw-bold, .user-name, .profile-name, h2')
        .first()
        .innerText({ timeout: 5000 })
    ).trim();
  } catch {
    return 'Unknown';
  }
}

export async function scrapePerencanaanTable(page: Page): Promise<PerencanaanRow[]> {
  const out: PerencanaanRow[] = [];
  const rows = page.locator('table.table-bordered tbody tr');
  const countP = await rows.count();
  for (let i = 0; i < countP; i++) {
    const cells = rows.nth(i).locator('td');
    const cCount = await cells.count();
    if (cCount >= 4) {
      const rowText = await rows.nth(i).innerText();
      if (rowText.includes('No data') || rowText.includes('Batas KPI')) continue;
      out.push({
        jenis: cCount > 1 ? (await cells.nth(1).innerText()).trim() : '',
        nama: cCount > 2 ? (await cells.nth(2).innerText()).trim() : '',
        formula: cCount > 5 ? (await cells.nth(5).innerText()).trim() : '',
        polaritas: cCount > 6 ? (await cells.nth(6).innerText()).trim() : '',
      });
    }
  }
  return out;
}

export async function scrapePenilaianTable(page: Page): Promise<PenilaianRow[]> {
  const out: PenilaianRow[] = [];
  const rowsPenilaian = page.locator('table.table-bordered tbody tr');
  const countPen = await rowsPenilaian.count();
  for (let i = 0; i < countPen; i++) {
    const cells = rowsPenilaian.nth(i).locator('td');
    const cCount = await cells.count();
    if (cCount >= 4) {
      const rowText = await rowsPenilaian.nth(i).innerText();
      if (rowText.includes('Total') || rowText.includes('No data')) continue;
      out.push({
        nama: cCount > 1 ? (await cells.nth(1).innerText()).trim() : '',
        target1Th: cCount > 4 ? (await cells.nth(4).innerText()).trim() : '',
        targetSmt1: cCount > 5 ? (await cells.nth(5).innerText()).trim() : '',
        realisasiSmt1: cCount > 6 ? (await cells.nth(6).innerText()).trim() : '',
        sisaTarget: cCount > 7 ? (await cells.nth(7).innerText()).trim() : '',
        skor: cCount > 8 ? (await cells.nth(8).innerText()).trim() : '',
      });
    }
  }
  return out;
}

export function penilaianToShort(rows: PenilaianRow[]): PenilaianRowShort[] {
  return rows.map((r) => ({
    nama: r.nama,
    target1Th: r.target1Th,
    skor: r.skor,
  }));
}

function ensureReportsDir(): string {
  const dir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Tulis batch scrape ke `reports/` atau path penuh dari `KPI_SCRAPE_OUT`. */
export function writeKpiScrapeBatch(batch: KpiScrapeBatch): string {
  const explicit = process.env.KPI_SCRAPE_OUT?.trim();
  const file =
    explicit && explicit.length > 0
      ? explicit
      : path.join(
          ensureReportsDir(),
          `kpi-scrape-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        );
  if (!explicit) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(batch, null, 2), 'utf8');
  return file;
}

/** Tulis hasil fill KPI (opsional; env `KPI_FILL_OUT` = path penuh, atau auto di `reports/`). */
export function writeKpiFillBatch(batch: KpiFillBatch): string {
  const explicit = process.env.KPI_FILL_OUT?.trim();
  const file =
    explicit && explicit.length > 0
      ? explicit
      : path.join(
          ensureReportsDir(),
          `kpi-fill-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(batch, null, 2), 'utf8');
  return file;
}
