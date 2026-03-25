# QA Tools CLI Pipeline (Prestasiku)

## Overview

Proyek ini adalah toolchain berbasis TypeScript untuk otomasi QA (Quality Assurance) pada proyek Prestasiku. Pipeline ini berfungsi untuk mengambil data *backlog* (Epic & User Story) dari file *spreadsheet*, lalu mengotomatisasi pembuatan dokumen skenario *Test Cases* (berformat Markdown) dan skrip *Test End-to-End* (Playwright TypeScript) berbasis *Artificial Intelligence* (menggunakan OpenRouter API) berdasarkan laporan target yang diambil dari *daily standup* (BASR).

---

## Workflow (Cara Penggunaan)

Pipeline ini terdiri dari dua perintah CLI utama yang dijalankan secara sekuensial:

### 1. Sinkronisasi Data Backlog (`npm run parse`)

Proses pertama adalah memastikan master data terbaru sudah terindeks ke format lokal sehingga AI mengenali spesifikasi per _backlog_. Letakkan file `mastersheet.xlsx` di `data/`.

```bash
npm run parse
```
*Script ini akan memilah file, mendeteksi ID dengan format otomatis (misal: `E1.S1`), dan mencadangkan data *User Story* ke dalam `backlog.json`.*

### 2. Mempersiapkan Laporan Harian (Daily)

Siapkan referensi *daily standup* menggunakan teks markdown (`.md`) di direktori `daily/`. File berisi tabel status *story* yang telah berstatus `Done`.

Teks patokan di sebuah kolom bernama `Done: {EPIC_ID}.{STORY_ID}` wajib ada.
**Contoh isian `daily/2026-03-24.md`**:
```markdown
# Laporan BASR

| No | Nama Talent | Laporan |
|---|---|---|
| 1 | Tester A | **Done:** E1.S1, E2.S2 |
```

### 3. Generate Skrip Test Otomatis (`npm run generate:daily`)

Kirim rujukan markdown *(daily)* untuk menginstruksikan AI mencocokkan ID *Done* dengan Acceptance Criteria (AC) pada Master backlog dan menghasilkan Test Case otomatis.

```bash
# Menghasilkan Manual Test Case MD ke direktori `test-cases/`
npm run generate:daily -- --daily daily/2026-03-24.md

# Menghasilkan Manual Test Case (MD) sekaligus Playwright automation code (*.spec.ts) di `tests/`
npm run generate:daily -- --daily daily/2026-03-24.md --playwright

# Mengesampingkan model di dalam .env (Manual Flag)
npm run generate:daily -- --daily daily/2026-03-24.md --playwright --model mistralai/mistral-7b-instruct
```

> **Catatan:** Jika *rate limit* dari API di OpenRouter tercapai (error `429`), *fallback generator* akan menyimpan payload JSON *raw* di `test-cases/ID-raw.txt` agar referensi proses *retry* kelak tidak hilang.

### 4. Eksekusi End-to-End dengan Playwright

Setelah rujukan uji berhasil memproduksi file `tests/*.spec.ts`, spesifikasi tersebut bisa langsung ditelusuri Playwright.

```bash
# Ujicoba Test headless biasa
npx playwright test tests/2026-03-24.spec.ts

# Run test ke UI Mode Interactive
npx playwright test --ui
```
