import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import { BacklogItem, BacklogFile, TrackingEntry, TrackingFile } from './backlog-types';

const args = minimist(process.argv.slice(2), {
  default: {
    file: 'data/mastersheet.xlsx',
    sheet: 'Sprint Web',
    'data-row': 5
  }
});

const COL = {
  no: 0, epic: 1, user_story: 2, deskripsi: 3, ac: 4, jumlah_ac: 5,
  kebutuhan: 6, sprint: 7, status_be: 16, persen_be: 17, status_fe: 21,
  persen_fe: 22, pic_qa: 24, status_qa: 25, persen_qa: 26, catatan_qa: 27
};

function getCellValue(ws: xlsx.WorkSheet, row: number, col: number): string {
  const merges = ws['!merges'] || [];
  for (const merge of merges) {
    if (row >= merge.s.r && row <= merge.e.r && col >= merge.s.c && col <= merge.e.c) {
      const addr = xlsx.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      return String(ws[addr]?.v ?? '').trim();
    }
  }
  const addr = xlsx.utils.encode_cell({ r: row, c: col });
  return String(ws[addr]?.v ?? '').trim();
}

function extractEpicCode(epic: string): string {
  const m = epic.match(/\[([^\]]+)\]/);
  if (!m) return 'E?';
  return m[1].trim().split(/[\s\-]/)[0];
}

function extractStoryCode(story: string): string {
  const m = story.match(/\[([^\]]+)\]/);
  if (m) return m[1].trim().split(/[\s\-]/)[0];
  const m2 = story.match(/^(S\d+)/);
  return m2 ? m2[1] : 'S?';
}

function makeBacklogId(epicStr: string, storyStr: string): string {
  return `${extractEpicCode(epicStr)}.${extractStoryCode(storyStr)}`;
}

function isDone(status: string, persen: string): boolean {
  const s = (status || "").toLowerCase();
  const p = (persen || "").replace("%", "").trim();
  if (s === "done" || s === "done integrasi" || s === "selesai") return true;
  const num = parseFloat(p);
  return !isNaN(num) && num >= 100;
}

function readyToTest(statusBe: string, persenBe: string, statusFe: string, persenFe: string): 'ready_to_test' | 'partial' | 'not_ready' {
  const be = isDone(statusBe, persenBe);
  const fe = isDone(statusFe, persenFe);
  if (be && fe) return 'ready_to_test';
  if (be || fe) return 'partial';
  return 'not_ready';
}

function main() {
  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`File tidak ditemukan: ${filePath}`);
    process.exit(1);
  }

  console.log(`Parsing ${path.basename(filePath)}...`);
  const wb = xlsx.readFile(filePath, { cellFormula: false });

  let sheetNames = [args.sheet];
  if (!wb.SheetNames.includes(args.sheet)) {
    if (minimist(process.argv.slice(2)).sheet) {
      console.error(`Sheet '${args.sheet}' tidak ditemukan. Tersedia: ${wb.SheetNames.join(', ')}`);
      process.exit(1);
    } else {
      if (!wb.SheetNames.includes(args.sheet)) {
        console.log(`Sheet '${args.sheet}' tidak ditemukan. Menggunakan sheet pertama.`);
        sheetNames = [wb.SheetNames[0]]; // fallback
      }
    }
  }

  const items: BacklogItem[] = [];
  const seenIds: Record<string, number> = {};

  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rangeStr = ws['!ref'] || 'A1:A1';
    const range = xlsx.utils.decode_range(rangeStr);
    const maxRow = range.e.r;

    let epicCarry = "";
    const dataRow = parseInt(args['data-row']) || 5;
    let sprintCarry = "Sprint 1";

    const startIdx = Math.max(0, dataRow - 1);
    let noCounter = 1;
    for (let r = startIdx; r <= maxRow; r++) {
      const storyRaw = getCellValue(ws, r, COL.user_story);
      if (!storyRaw || storyRaw.toLowerCase().includes('user story') || storyRaw.toLowerCase() === 'fitur') continue;

      let noVal = getCellValue(ws, r, COL.no);
      let parsedNo = 0;
      if (!noVal || !/^\d+$/.test(noVal)) {
        parsedNo = noCounter;
      } else {
        parsedNo = parseInt(noVal, 10);
        noCounter = parsedNo;
      }
      noCounter++;

      const epicRaw = getCellValue(ws, r, COL.epic);
      if (epicRaw) epicCarry = epicRaw;

      const deskripsi = getCellValue(ws, r, COL.deskripsi).replace(/\s+/g, ' ');
      const acRaw = getCellValue(ws, r, COL.ac);
      const jumlahAc = getCellValue(ws, r, COL.jumlah_ac);
      const kebutuhan = getCellValue(ws, r, COL.kebutuhan);

      const sprintRaw = getCellValue(ws, r, COL.sprint);
      if (sprintRaw) sprintCarry = sprintRaw;

      const statusBe = getCellValue(ws, r, COL.status_be);
      const persenBe = getCellValue(ws, r, COL.persen_be);
      const statusFe = getCellValue(ws, r, COL.status_fe);
      const persenFe = getCellValue(ws, r, COL.persen_fe);
      const picQa = getCellValue(ws, r, COL.pic_qa);
      const statusQa = getCellValue(ws, r, COL.status_qa);
      const persenQa = getCellValue(ws, r, COL.persen_qa);
      const catatanQa = getCellValue(ws, r, COL.catatan_qa);

      const baseId = makeBacklogId(epicCarry, storyRaw);
      let blId = baseId;
      if (seenIds[baseId]) {
        seenIds[baseId]++;
        blId = `${baseId}-v${seenIds[baseId]}`;
      } else {
        seenIds[baseId] = 1;
      }

      const acLines = acRaw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      const numAc = /^\d+$/.test(jumlahAc) ? parseInt(jumlahAc, 10) : acLines.length;

      const statusTest = readyToTest(statusBe, persenBe, statusFe, persenFe);

      const item: BacklogItem = {
        id: blId,
        no: parsedNo,
        sheet: sheetName,
        epic: epicCarry,
        epic_code: extractEpicCode(epicCarry),
        user_story: storyRaw,
        story_code: extractStoryCode(storyRaw),
        deskripsi: deskripsi,
        acceptance_criteria: acLines,
        jumlah_ac: numAc,
        kebutuhan: kebutuhan,
        sprint: sprintCarry,
        dev_status: {
          be: statusBe || "-",
          be_progress: persenBe || "0%",
          fe: statusFe || "-",
          fe_progress: persenFe || "0%"
        },
        qa: {
          pic: picQa || "-",
          status: statusQa || "not_started",
          progress: persenQa || "0%",
          catatan: catatanQa || ""
        },
        ready_to_test: statusTest
      };
      items.push(item);
    }
  }

  const statReady = items.filter(i => i.ready_to_test === 'ready_to_test').length;
  const statPartial = items.filter(i => i.ready_to_test === 'partial').length;
  const statNotReady = items.filter(i => i.ready_to_test === 'not_ready').length;

  const todayStr = new Date().toISOString().split('T')[0];

  const backlogFile: BacklogFile = {
    _meta: {
      source: path.basename(filePath),
      generated_at: todayStr,
      total_items: items.length,
      ready_to_test: statReady,
      partial: statPartial,
      not_ready: statNotReady
    },
    items: items
  };

  fs.writeFileSync('backlog.json', JSON.stringify(backlogFile, null, 2), 'utf-8');
  console.log(`backlog.json -> ${items.length} items (${statReady} ready · ${statPartial} partial · ${statNotReady} not ready)`);
}

main();
