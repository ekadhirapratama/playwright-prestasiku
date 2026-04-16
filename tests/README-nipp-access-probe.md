# `nipp_access_probe.spec.ts` — cara pakai

Probe ini memeriksa apakah akun **NIPP** bisa mengakses halaman **Perencanaan Kinerja (pribadi)** dan **Penilaian Kinerja (pribadi)** tanpa error akses / error data pembina–KPI.

## Variabel lingkungan

| Variabel | Wajib | Default | Keterangan |
|----------|--------|---------|------------|
| `SMOKE_BASE_URL` | Tidak | `https://prestasikukaigroup-beta.kai.id` | Host uji (Beta/Alpha). Tanpa slash di akhir. |
| `NIPP_PROBE_LIST` | Tidak | Daftar bawaan di spec | NIPP dipisah koma atau spasi, contoh: `40398,43596,40879`. |

## Urutan alur

1. Buka `/nipp?nipp={NIPP}` (impersonasi).
2. Buka `/perencanaan-kinerja/pribadi` → polling singkat mendeteksi **terblokir** (Access Denied, pembina tidak ditemukan, pola KPI/grade belum set, dll.) vs **sukses** (kartu `.card-kinerja`, “Data perencanaan terakhir”, draft “Katalog Anda”, dll.).
3. Buka `/penilaian-kinerja/pribadi` → asersi heading **Pengajuan Penilaian Kinerja** tampak (lihat catatan di bawah — ini **bukan** tes denial akses yang valid untuk semua kebijakan).

## Contoh perintah

```bash
# Beta (default), satu worker (disarankan untuk probe panjang)
npx playwright test tests/nipp_access_probe.spec.ts --project=chromium --workers=1
```

```bash
# Alpha
SMOKE_BASE_URL=https://prestasikukaigroup-alpha.kai.id \
  npx playwright test tests/nipp_access_probe.spec.ts --project=chromium --workers=1
```

```bash
# Subset NIPP
NIPP_PROBE_LIST="40398,41988" \
  npx playwright test tests/nipp_access_probe.spec.ts --project=chromium --workers=1
```

```bash
# Hanya tes penilaian (grep pada judul test)
npx playwright test tests/nipp_access_probe.spec.ts --grep "penilaian pribadi" --project=chromium --workers=1
```

## Interpretasi hasil

### Perencanaan

- **`planningBlocked=false`**: halaman dianggap **tidak** terblokir; assertion `expect.soft(blocked).toBe(false)` lulus.
- **`planningBlocked=true`**: pola blokir terdeteksi; tes perencanaan untuk NIPP itu **gagal** (soft).
- **Log konsol** (setiap NIPP): baris `[probe perencanaan]` memuat `plansId` dan `jobId` bila pesan error mengikuti pola `plans: …` dan `job: …` (mis. *Data pembina binaan tidak ditemukan untuk plans: … dan job: …*). Gunakan untuk **cek manual** di sistem sumber.
- **Lampiran Playwright**: cuplikan body + baris `planningBlocked`, `plansId`, `jobId`, `message=…` (jika ada).

### Penilaian (`/penilaian-kinerja/pribadi`)

- Tes ini hanya memastikan **heading** halaman tampil (smoke UI). Banyak pengguna tetap bisa membuka route ini meski perencanaan menampilkan **Access Denied** dengan plans/job — jadi **PASS penilaian tidak membuktikan** bahwa akun “bebas akses” secara kebijakan, dan **tidak menggantikan** diagnosis dari tes perencanaan.
- Untuk investigasi pembina / ID rencana & pekerjaan, andalkan log & lampiran **perencanaan** di atas.

## Perbedaan dengan `fill_kpi` / `scrape_kpi`

| Spec | Tujuan |
|------|--------|
| `nipp_access_probe` | **Hanya** cek akses & pola blokir (minimal mutasi). |
| `fill_kpi` | Isi form KPI (mutasi) + snapshot penilaian. |
| `scrape_kpi` | Baca tabel perencanaan/penilaian → JSON (tanpa mengubah data). |
