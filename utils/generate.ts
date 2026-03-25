import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import * as dotenv from 'dotenv';
import { BacklogFile, BacklogItem, GeneratedTC } from './backlog-types';
import { openrouterChat, parseJsonFromAI } from './openrouter';

dotenv.config();

const args = minimist(process.argv.slice(2));

const DONE_PATTERN = /\b([A-Z]\d{1,3})[.\-,]([A-Z]\d{1,3})\b/gi;

interface DailyResult {
  date: string;
  raw: string;
  doneIds: string[];
  doneBy: Record<string, string>;
  context: string;
}

function parseDailyMd(filePath: string): DailyResult {
  const text = fs.readFileSync(filePath, 'utf-8');
  const dateMatch = path.basename(filePath, '.md').match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch?.[1] ?? '';

  const doneIds: string[] = [];
  const doneBy: Record<string, string> = {};
  let currentName = '';

  for (const line of text.split('\n')) {
    const nameMatch = line.match(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name && !['nama talent', 'no', '---'].includes(name.toLowerCase()))
        currentName = name;
    }
    const doneMatch = line.match(/\*{0,2}Done:\*{0,2}(.*?)(?:\*{0,2}Obstacle:\*{0,2}|$)/i);
    if (doneMatch) {
      for (const m of doneMatch[1].matchAll(DONE_PATTERN)) {
        const id = `${m[1].toUpperCase()}.${m[2].toUpperCase()}`;
        if (!doneIds.includes(id)) doneIds.push(id);
        if (!doneBy[id] && currentName) doneBy[id] = currentName;
      }
    }
  }
  const context = text.split('\n').filter(l => l.trim()).join('\n').slice(0, 800);
  return { date, raw: text, doneIds, doneBy, context };
}

const PROMPT_TC = `Kamu adalah QA engineer senior untuk aplikasi HR/KPI bernama Prestasiku.

## Backlog Item
ID         : {bl_id}
Epic       : {epic}
Story      : {user_story}
Deskripsi  : {deskripsi}

Acceptance Criteria:
{ac_text}

## Update Harian ({daily_date})
{context}

## Instruksi
Buat test case untuk backlog item di atas. Ketentuan:
- Minimal {n_pos} test case POSITIF (happy path, flow sukses)
- Minimal {n_neg} test case NEGATIF (validasi, edge case, error handling)
- Setiap AC harus terwakili minimal 1 test case
- Pertimbangkan konteks: aplikasi web HR, ada role (pekerja/atasan/admin), ada periode KPI
- Bahasa Indonesia
- tc_id menggunakan format: {bl_id}-TC01, {bl_id}-TC02, dst.

Kembalikan HANYA JSON array (tanpa teks lain, tanpa markdown fence):
[
  {
    "tc_id": "{bl_id}-TC01",
    "tipe": "positif",
    "judul": "judul singkat",
    "precondition": "kondisi awal sebelum test",
    "langkah": ["1. ...", "2. ...", "3. ..."],
    "expected_result": "hasil yang diharapkan",
    "actual_result": "",
    "status": "not_run",
    "notes": ""
  }
]`;

const PROMPT_PW = `Kamu adalah automation engineer yang ahli Playwright TypeScript.

## Test Cases
{tc_json}

## Konteks
- Aplikasi web HR/KPI (Prestasiku)
- Base URL: process.env.BASE_URL || 'http://localhost:3000'
- Login dengan: process.env.TEST_USER / process.env.TEST_PASS
- Gunakan accessible locators: getByRole, getByLabel, getByText

Buat Playwright spec TypeScript:
- test.describe per backlog item
- test.beforeEach hanya mengandung page.goto(process.env.BASE_URL ?? '')
- Setiap test case jadi satu test()
- Verifikasi error message untuk test NEGATIF
- Tambahkan komentar singkat per langkah penting

Kembalikan HANYA kode TypeScript:`;

async function main() {
  if (!args.daily) {
    console.error("Argumen --daily wajib diisi.");
    process.exit(1);
  }

  const dailyPath = path.resolve(args.daily);
  if (!fs.existsSync(dailyPath)) {
    console.error(`File daily tidak ditemukan: ${dailyPath}`);
    process.exit(1);
  }

  console.log(`Parsing daily: ${path.basename(dailyPath)}`);
  const daily = parseDailyMd(dailyPath);
  
  const reportDate = daily.date || path.basename(dailyPath, '.md');
  console.log(`Tanggal: ${reportDate}`);
  console.log(`Done IDs dari BASR: ${daily.doneIds.join(', ')}`);

  if (daily.doneIds.length === 0) {
    console.warn("Tidak ada item Done yang terdeteksi di file daily.");
    process.exit(0);
  }

  const backlogPath = path.resolve('backlog.json');
  if (!fs.existsSync(backlogPath)) {
    console.error("File backlog.json tidak ditemukan. Jalankan npm run parse terlebih dahulu.");
    process.exit(1);
  }

  const backlog: BacklogFile = JSON.parse(fs.readFileSync(backlogPath, 'utf-8'));
  const blMap = new Map<string, BacklogItem>();
  for (const item of backlog.items) {
    blMap.set(item.id, item);
  }

  const targets: BacklogItem[] = [];
  for (const doneId of daily.doneIds) {
    if (blMap.has(doneId)) {
      targets.push(blMap.get(doneId)!);
    } else {
      console.warn(`  ${doneId} — tidak ditemukan di backlog.json (skip)`);
    }
  }

  if (targets.length === 0) {
    console.warn("Tidak ada item yang cocok dengan backlog.json.");
    process.exit(0);
  }

  console.log(`Item yang akan di-generate: ${targets.map(t => t.id).join(', ')}`);

  const allSections: string[] = [];
  const allPwTcs: GeneratedTC[] = [];

  for (const item of targets) {
    const blId = item.id;
    console.log(`  Generating ${blId} — ${item.user_story}`);

    const acLines = item.acceptance_criteria || [];
    const acText = acLines.length > 0 ? acLines.map(l => `  ${l}`).join('\n') : "  (tidak tersedia)";

    const nAc = Math.max(item.jumlah_ac || 3, 3);
    const nPos = Math.max(3, Math.floor(nAc / 2));
    const nNeg = Math.max(3, Math.floor(nAc / 2));

    const prompt = PROMPT_TC
      .replace(/\{bl_id\}/g, blId)
      .replace(/\{epic\}/g, item.epic)
      .replace(/\{user_story\}/g, item.user_story)
      .replace(/\{deskripsi\}/g, item.deskripsi)
      .replace(/\{ac_text\}/g, acText)
      .replace(/\{daily_date\}/g, reportDate)
      .replace(/\{context\}/g, daily.context)
      .replace(/\{n_pos\}/g, nPos.toString())
      .replace(/\{n_neg\}/g, nNeg.toString());

    let tcs: GeneratedTC[] = [];
    let raw = "";
    try {
      raw = await openrouterChat(prompt, args.model);
      tcs = parseJsonFromAI(raw);
      console.log(`    ${tcs.length} test cases generated`);
    } catch (e: any) {
      console.warn(`    Gagal parse JSON untuk ${blId}: ${e.message}`);
      const rawDir = path.resolve('test-cases');
      if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
      const rawPath = path.join(rawDir, `${blId}-raw-${reportDate}.txt`);
      fs.writeFileSync(rawPath, raw, 'utf-8');
      console.warn(`    Raw response disimpan: ${rawPath}`);
      continue;
    }

    const doneBy = daily.doneBy[blId] || "-";
    const section = [
      `## ${blId} — ${item.user_story}`,
      `**Epic:** ${item.epic}  `,
      `**Sprint:** ${item.sprint}  `,
      `**Done by:** ${doneBy}  `,
      `**AC:** ${item.jumlah_ac}  `,
      ``
    ];

    for (const tc of tcs) {
      section.push(
        `### ${tc.tc_id || '?'} · ${tc.judul || ''}`,
        `**Tipe:** \`${tc.tipe || ''}\`  `,
        `**Precondition:** ${tc.precondition || ''}  `,
        ``,
        `**Langkah:**`
      );
      for (const step of (tc.langkah || [])) {
        section.push(`- ${step}`);
      }
      section.push(
        ``,
        `**Expected Result:** ${tc.expected_result || ''}  `,
        `**Actual Result:** _${tc.actual_result || 'belum dirun'}_  `,
        `**Status:** \`${tc.status || 'not_run'}\`  `,
        ``
      );
    }
    allSections.push(section.join('\n'));
    allPwTcs.push(...tcs);
  }

  if (allSections.length === 0) {
    console.warn("Tidak ada TC yang berhasil di-generate.");
    process.exit(0);
  }

  const tcDir = path.resolve('test-cases');
  if (!fs.existsSync(tcDir)) fs.mkdirSync(tcDir, { recursive: true });

  const header = [
    `# Test Cases — ${reportDate}`,
    `**Sumber daily:** ${path.basename(dailyPath)}  `,
    `**Generated:** ${new Date().toISOString().split('T')[0]}  `,
    `**Items:** ${targets.map(t => t.id).join(', ')}  `,
    `**Total TC:** ${allPwTcs.length}  `,
    ``,
    `---`,
    ``
  ];

  const outPath = path.join(tcDir, `${reportDate}.md`);
  fs.writeFileSync(outPath, header.join('\n') + '\n' + allSections.join('\n---\n\n'), 'utf-8');
  console.log(`test-cases/${reportDate}.md -> ${allPwTcs.length} TCs (${targets.map(t => t.id).join(', ')})`);

  if (args.playwright && allPwTcs.length > 0) {
    const pwDir = path.resolve('tests');
    if (!fs.existsSync(pwDir)) fs.mkdirSync(pwDir, { recursive: true });

    const pwPrompt = PROMPT_PW.replace(/\{tc_json\}/g, JSON.stringify(allPwTcs, null, 2));
    try {
      console.log(`  Memulai generate Playwright test...`);
      const pwRaw = await openrouterChat(pwPrompt, args.model);
      const pwCodeMatch = pwRaw.match(/```(?:typescript|ts)?\n?([\s\S]*?)```/);
      const pwCode = pwCodeMatch ? pwCodeMatch[1].trim() : pwRaw.trim();
      const specPath = path.join(pwDir, `${reportDate}.spec.ts`);
      fs.writeFileSync(specPath, pwCode, 'utf-8');
      console.log(`tests/${reportDate}.spec.ts dibuat`);
    } catch (e: any) {
      console.warn(`Gagal generate Playwright spec: ${e.message}`);
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
