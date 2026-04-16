/**
 * Probe akses: perencanaan & penilaian pribadi. Host: SMOKE_BASE_URL (default Beta).
 *
 * Perencanaan: URL /perencanaan-kinerja/pribadi — gagal: Access Denied / pola error;
 * sukses: .card-kinerja, "Data perencanaan terakhir", atau alur Draft ("Draft Perencanaan",
 * "Katalog Anda", "Batas KPI Reguler"). Polling: terblokir vs sukses vs timeout.
 *
 * Dokumentasi penggunaan (env, contoh perintah, interpretasi): tests/README-nipp-access-probe.md
 *
 * Contoh cepat — Alpha, satu worker:
 * SMOKE_BASE_URL=https://prestasikukaigroup-alpha.kai.id npx playwright test tests/nipp_access_probe.spec.ts --project=chromium --workers=1
 *
 * Subset NIPP:
 * NIPP_PROBE_LIST="40398,41988" npx playwright test tests/nipp_access_probe.spec.ts --project=chromium --workers=1
 */
import { test, expect } from '@playwright/test';

const BASE =
  process.env.SMOKE_BASE_URL?.replace(/\/$/, '') ??
  'https://prestasikukaigroup-beta.kai.id';

const NIPPS = (
  process.env.NIPP_PROBE_LIST?.split(/[\s,]+/).filter(Boolean) ?? [
    '40398',
    '43596',
    '40879',
    '40968',
    '40969',
    '40404',
    '40826',
    '74654',
    '41988',
    '41995',
    '41077',
    '70258',
    '41082',
  ]
) as string[];

/** Teks yang mengindikasikan halaman perencanaan terblokir / error konfigurasi data. */
function getPerencanaanBlockedPattern(body: string): string | null {
  const b = body.replace(/\s+/g, ' ');
  const patterns: { re: RegExp; label: string }[] = [
    { re: /Access Denied/i, label: 'Access Denied' },
    { re: /akses ditolak/i, label: 'Akses Ditolak' },
    { re: /tidak memiliki akses/i, label: 'Tidak Memiliki Akses' },
    { re: /pembina binaan tidak ditemukan/i, label: 'Pembina Tidak Ditemukan' },
    { re: /Data pembina binaan tidak ditemukan/i, label: 'Data Pembina Tidak Ditemukan' },
    { re: /Pembina binaan tidak ditemukan/i, label: 'Pembina Tidak Ditemukan' },
    { re: /Grade Not Set/i, label: 'Grade Not Set' },
    { re: /indikator.*grade.*belum/i, label: 'Indikator Grade Belum Set' },
    { re: /Indikator grade \d+ belum di set/i, label: 'Indikator Grade Belum Set' },
    { re: /KPI belum di setting/i, label: 'KPI Belum Setting' },
    { re: /KPI belum di-set/i, label: 'KPI Belum Set' },
  ];
  const match = patterns.find((p) => p.re.test(b));
  return match ? match.label : null;
}

/** Satu pemeriksaan; jangan dipakai sendirian sebelum UI async (Alpine/API) selesai. */
async function snapshotPlanningBlocked(
  page: import('@playwright/test').Page,
): Promise<{ blocked: boolean; reason?: string }> {
  const accessDeniedHeading = page.getByRole('heading', {
    name: /^Access Denied$/i,
  });
  if (await accessDeniedHeading.isVisible().catch(() => false)) {
    return { blocked: true, reason: 'Heading: Access Denied' };
  }

  const accessDeniedText = page.getByText(/^Access Denied$/i);
  if (await accessDeniedText.first().isVisible().catch(() => false)) {
    return { blocked: true, reason: 'Text: Access Denied' };
  }

  const accessDeniedH5 = page
    .locator('h5.fw-semibold.text-warning')
    .filter({ hasText: /^Access Denied$/i });
  if (await accessDeniedH5.first().isVisible().catch(() => false)) {
    return { blocked: true, reason: 'H5: Access Denied' };
  }

  const emptyStateImg = page.locator(
    'img[src*="data-kosong"], img[src*="data-kosong.png"]',
  );
  const pembinaMsg = page.locator('p.text-muted').filter({
    hasText: /pembina binaan tidak ditemukan|Data pembina binaan/i,
  });
  if (
    (await emptyStateImg.first().isVisible().catch(() => false)) &&
    (await pembinaMsg.first().isVisible().catch(() => false))
  ) {
    return { blocked: true, reason: 'Empty State: Pembina Tidak Ditemukan' };
  }

  const body = await page.locator('body').innerText();
  const patternMatch = getPerencanaanBlockedPattern(body);
  if (patternMatch) {
    return { blocked: true, reason: `Pattern: ${patternMatch}` };
  }

  return { blocked: false };
}

/**
 * Halaman perencanaan sukses (Beta): kartu utama `.card-kinerja`, blok "Data perencanaan
 * terakhir", atau alur pengisian draft (stepper "Katalog Anda", heading Draft, teks batas KPI).
 */
async function snapshotPlanningSuccess(
  page: import('@playwright/test').Page,
): Promise<boolean> {
  if (await page.locator('.card-kinerja').first().isVisible().catch(() => false)) {
    return true;
  }
  if (
    await page
      .getByText('Data perencanaan terakhir', { exact: true })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return true;
  }
  if (
    await page
      .getByRole('heading', { name: /^Draft Perencanaan$/i })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return true;
  }
  if (
    await page.getByText('Katalog Anda').first().isVisible().catch(() => false)
  ) {
    return true;
  }
  if (
    await page.getByText(/Batas KPI Reguler/).first().isVisible().catch(() => false)
  ) {
    return true;
  }
  if (
    await page.getByRole('button', { name: /\+?\s*KPI Reguler/i }).first().isVisible().catch(() => false)
  ) {
    return true;
  }
  if (
    await page.getByText(/APPROVE ATASAN/i).first().isVisible().catch(() => false)
  ) {
    return true;
  }
  if (
    await page.getByText(/APPROVE ADMIN/i).first().isVisible().catch(() => false)
  ) {
    return true;
  }
  return false;
}

/**
 * Deteksi terblokir: struktur DOM / pola teks error; setelah `load`, Alpine/API bisa telat.
 * Polling: jika sukses terlihat → tidak terblokir (keluar cepat); jika pola terblokir → true;
 * jika timeout → pemeriksaan akhir.
 */
async function isPlanningPageBlocked(
  page: import('@playwright/test').Page,
  options?: { settleMs?: number; pollMs?: number; maxWaitMs?: number },
): Promise<{ blocked: boolean; reason?: string }> {
  const settleMs = options?.settleMs ?? 30_000;
  const pollMs = options?.pollMs ?? 400;
  const maxWaitMs = options?.maxWaitMs ?? 20_000;

  await page.waitForLoadState('networkidle', { timeout: settleMs }).catch(() => {});

  const end = Date.now() + maxWaitMs;
  while (Date.now() < end) {
    // Jalankan sukses dulu agar jika sudah sukses tidak perlu cek blocked (mengurangi false positive)
    if (await snapshotPlanningSuccess(page)) return { blocked: false };
    
    const blockCheck = await snapshotPlanningBlocked(page);
    if (blockCheck.blocked) return blockCheck;

    await new Promise((r) => setTimeout(r, pollMs));
  }
  
  // Final check
  if (await snapshotPlanningSuccess(page)) return { blocked: false };
  return await snapshotPlanningBlocked(page);
}

async function closeDialogs(page: import('@playwright/test').Page) {
  const ok = page.locator('button.swal2-confirm');
  if (await ok.isVisible().catch(() => false)) await ok.click();
  const tutup = page.getByRole('button', { name: /^Tutup$/i });
  if (await tutup.isVisible().catch(() => false)) await tutup.click();
}

/**
 * Teks detail di bawah heading "Access Denied" (mis. `p.text-muted.mb-0`, Alpine `x-text`
 * dari store pegawai). Dipakai untuk verifikasi manual plans/job.
 */
async function readAccessDeniedDetailMessage(
  page: import('@playwright/test').Page,
): Promise<string> {
  const inCard = page
    .locator('.card-body')
    .filter({ has: page.getByRole('heading', { name: /^Access Denied$/i }) })
    .locator('p.text-muted')
    .first();
  if (await inCard.isVisible().catch(() => false)) {
    return (await inCard.innerText()).trim();
  }
  const loose = page.locator('p.text-muted.mb-0').first();
  if (await loose.isVisible().catch(() => false)) {
    return (await loose.innerText()).trim();
  }
  return '';
}

/** Contoh sumber teks: "… untuk plans: 92087549 dan job: 96000830." */
function parsePlansAndJobIds(message: string): {
  plansId?: string;
  jobId?: string;
} {
  const plansId = message.match(/plans:\s*(\d+)/i)?.[1];
  const jobId = message.match(/job:\s*(\d+)/i)?.[1];
  return { plansId, jobId };
}

for (const nipp of NIPPS) {
  test.describe(`NIPP ${nipp}`, () => {
    test(`perencanaan pribadi — tidak Access Denied / error pembina–KPI`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('requestfailed', (request) => {
        consoleErrors.push(`Request failed: ${request.url()} (${request.failure()?.errorText})`);
      });

      const response = await page.goto(`${BASE}/nipp?nipp=${nipp}`, {
        waitUntil: 'load',
        timeout: 90_000,
      });

      // Handle JSON response (login error case)
      const bodyText = await page.innerText('body').catch(() => '');
      if (bodyText.includes('"status":"error"') || bodyText.includes('Login gagal')) {
        console.log(`[probe perencanaan] host=${BASE} nipp=${nipp} login_failed=true message=${JSON.stringify(bodyText)}`);
        test.info().attach(`login-fail-${nipp}`, {
          body: bodyText,
          contentType: 'text/plain',
        });
        expect.soft(true, `Login gagal untuk NIPP ${nipp}`).toBe(false);
        return;
      }

      await closeDialogs(page);
      await page.goto(`${BASE}/perencanaan-kinerja/pribadi`, {
        waitUntil: 'load',
        timeout: 90_000,
      });
      await closeDialogs(page);
      
      const { blocked, reason } = await isPlanningPageBlocked(page);
      const body = await page.locator('body').innerText({ timeout: 15_000 }).catch(() => '');
      await expect(page).toHaveURL(/perencanaan-kinerja\/pribadi/);

      const accessDeniedHeading = page.getByRole('heading', {
        name: /^Access Denied$/i,
      });
      const showsAccessDenied = await accessDeniedHeading
        .first()
        .isVisible()
        .catch(() => false);
      const detailMessage =
        blocked || showsAccessDenied
          ? await readAccessDeniedDetailMessage(page)
          : '';
      const { plansId, jobId } = parsePlansAndJobIds(detailMessage || body);

      const logLine = [
        `[probe perencanaan] host=${BASE}`,
        `nipp=${nipp}`,
        `planningBlocked=${blocked}`,
        `plansId=${plansId ?? '—'}`,
        `jobId=${jobId ?? '—'}`,
        blocked ? `reason=${JSON.stringify(reason)}` : '',
        consoleErrors.length > 0 ? `consoleErrors=${consoleErrors.length}` : '',
        detailMessage ? `message=${JSON.stringify(detailMessage)}` : '',
        `url=${page.url()}`,
      ]
        .filter(Boolean)
        .join(' ');
      console.log(logLine);

      const attachBody = [
        `planningBlocked=${blocked}`,
        `reason=${reason ?? '—'}`,
        `plansId=${plansId ?? ''}`,
        `jobId=${jobId ?? ''}`,
        detailMessage ? `message=${detailMessage}` : '',
        consoleErrors.length > 0 ? `consoleErrors:\n${consoleErrors.join('\n')}` : '',
        '---',
        body.slice(0, 3500),
      ]
        .filter((line) => line !== '')
        .join('\n');
      test.info().attach(`perencanaan-${nipp}`, {
        body: attachBody,
        contentType: 'text/plain',
      });
      expect.soft(blocked, `perencanaan terblokir untuk NIPP ${nipp} (${reason})`).toBe(false);
    });

    // test(`penilaian pribadi — halaman terbuka`, async ({ page }) => {
    //   await page.goto(`${BASE}/nipp?nipp=${nipp}`, {
    //     waitUntil: 'load',
    //     timeout: 90_000,
    //   });
    //   await closeDialogs(page);
    //   await page.goto(`${BASE}/penilaian-kinerja/pribadi`, {
    //     waitUntil: 'load',
    //     timeout: 90_000,
    //   });
    //   await closeDialogs(page);
    //   await expect(
    //     page.getByRole('heading', { name: /Pengajuan Penilaian Kinerja/i }).first(),
    //   ).toBeVisible({ timeout: 25_000 });
    // });
  });
}
