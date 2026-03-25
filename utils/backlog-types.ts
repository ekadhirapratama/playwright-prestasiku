export interface BacklogItem {
  id: string;            // 'E2.S23'
  no: number;
  sheet: string;
  epic: string;
  epic_code: string;
  user_story: string;
  story_code: string;
  deskripsi: string;
  acceptance_criteria: string[];
  jumlah_ac: number;
  kebutuhan: string;
  sprint: string;
  dev_status: {
    be: string; be_progress: string;
    fe: string; fe_progress: string;
  };
  qa: { pic: string; status: string; progress: string; catatan: string };
  ready_to_test: 'ready_to_test' | 'partial' | 'not_ready';
}

export interface GeneratedTC {
  tc_id: string;         // 'E2.S23-TC01'
  tipe: 'positif' | 'negatif';
  judul: string;
  precondition: string;
  langkah: string[];
  expected_result: string;
  actual_result: string;
  status: 'not_run' | 'pass' | 'fail' | 'blocked';
  notes: string;
}

export interface TrackingEntry {
  backlog_id: string;
  user_story: string;
  epic: string;
  sprint: string;
  pic_qa: string;
  status: 'not_started' | 'in_progress' | 'done' | 'blocked';
  notes: string;
  test_cases: GeneratedTC[];
  summary: { total: number; pass: number; fail: number; blocked: number; not_run: number };
  last_run: string | null;
}

export interface BacklogFile {
  _meta: Record<string, unknown>;
  items: BacklogItem[];
}

export interface TrackingFile {
  _meta: Record<string, unknown>;
  tracking: TrackingEntry[];
}
