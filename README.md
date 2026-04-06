# QA Tools CLI Pipeline (Prestasiku)

## Overview

Proyek ini adalah toolchain berbasis TypeScript untuk otomasi QA pada proyek Prestasiku. Saat ini repositori mempertahankan dua fungsi utama:

- Parsing backlog dari spreadsheet ke `backlog.json` (`npm run parse`).
- Menjalankan spesifikasi Playwright di direktori `tests/`.

Fitur otomatisasi pembuatan test case/spec melalui AI (`generate` / `generate:daily`) telah dipensiunkan dan telah dihapus dari repositori. Untuk membuat spec baru, silakan buat file `*.spec.ts` secara manual di `tests/` atau gunakan skrip arsip jika tersedia.

---

## Workflow (Cara Penggunaan)

### 1. Sinkronisasi Data Backlog (`npm run parse`)

Letakkan file `mastersheet.xlsx` di `data/`, lalu jalankan:

```bash
npm run parse
```

Perintah ini akan membaca spreadsheet dan menulis `backlog.json` di root proyek.

### 2. Menulis / Menambah Spesifikasi Playwright

Pembuatan spesifikasi Playwright kini dilakukan secara manual. Buat file `tests/xxxx.spec.ts` mengikuti pola Playwright di proyek, atau salin dan modifikasi `tests/testcase1.spec.ts` sebagai template.

### 3. Eksekusi End-to-End dengan Playwright

Setelah ada file `tests/*.spec.ts`, jalankan:

```bash
# Ujicoba Test headless biasa
npx playwright test

# Run test ke UI Mode Interactive
npx playwright test --ui
```

---

Jika Anda ingin mengembalikan fitur otomatisasi AI di masa depan, beri tahu saya — saya bisa membantu mengembalikan atau mengimplementasikan ulang pipeline tersebut sebagai opsi terpisah.
