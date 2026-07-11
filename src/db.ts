import * as duckdb from '@duckdb/duckdb-wasm';

export interface StudySession {
  id: string;
  type: 'study' | 'break';
  duration_minutes: number;
  completed: boolean;
  completed_at: string;
  created_at: string;
}

const STORAGE_KEY = 'study_timer_sessions';

// ── DuckDB singleton ──────────────────────────────────────────────────────────

let _db: duckdb.AsyncDuckDB | null = null;
let _initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function initDB(): Promise<duckdb.AsyncDuckDB> {
  const BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
      mainModule: '/duckdb/duckdb-mvp.wasm',
      mainWorker: '/duckdb/duckdb-browser-mvp.worker.js',
    },
    eh: {
      mainModule: '/duckdb/duckdb-eh.wasm',
      mainWorker: '/duckdb/duckdb-browser-eh.worker.js',
    },
  };

  const bundle = await duckdb.selectBundle(BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule);

  const conn = await db.connect();

  await conn.query(`
    CREATE TABLE IF NOT EXISTS study_sessions (
      id           VARCHAR PRIMARY KEY,
      type         VARCHAR NOT NULL,
      duration_minutes INTEGER NOT NULL,
      completed    BOOLEAN NOT NULL DEFAULT false,
      completed_at TIMESTAMP NOT NULL,
      created_at   TIMESTAMP NOT NULL
    )
  `);

  // Restore persisted rows from localStorage
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const rows: StudySession[] = JSON.parse(raw);
      for (const r of rows) {
        await conn.query(`
          INSERT OR IGNORE INTO study_sessions VALUES (
            '${esc(r.id)}',
            '${esc(r.type)}',
            ${r.duration_minutes},
            ${r.completed},
            '${r.completed_at}',
            '${r.created_at}'
          )
        `);
      }
    } catch {
      // corrupt data — start fresh
    }
  }

  await conn.close();
  return db;
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

export async function getDB(): Promise<duckdb.AsyncDuckDB> {
  if (_db) return _db;
  if (!_initPromise) _initPromise = initDB();
  _db = await _initPromise;
  return _db;
}

// ── Persistence helpers ───────────────────────────────────────────────────────

async function persist(): Promise<void> {
  const sessions = await fetchSessions();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function logSession(
  type: 'study' | 'break',
  durationMinutes: number,
  completed: boolean
): Promise<void> {
  const db = await getDB();
  const conn = await db.connect();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await conn.query(`
    INSERT INTO study_sessions VALUES (
      '${id}',
      '${type}',
      ${durationMinutes},
      ${completed},
      '${now}',
      '${now}'
    )
  `);
  await conn.close();
  await persist();
}

export async function fetchSessions(): Promise<StudySession[]> {
  const db = await getDB();
  const conn = await db.connect();
  const result = await conn.query(
    `SELECT * FROM study_sessions ORDER BY created_at DESC LIMIT 100`
  );
  await conn.close();

  const rows: StudySession[] = [];
  for (const batch of result.batches) {
    const n = batch.numRows;
    for (let i = 0; i < n; i++) {
      rows.push({
        id:               String(batch.getChildAt(0)?.get(i) ?? ''),
        type:             String(batch.getChildAt(1)?.get(i) ?? '') as 'study' | 'break',
        duration_minutes: Number(batch.getChildAt(2)?.get(i) ?? 0),
        completed:        Boolean(batch.getChildAt(3)?.get(i)),
        completed_at:     String(batch.getChildAt(4)?.get(i) ?? ''),
        created_at:       String(batch.getChildAt(5)?.get(i) ?? ''),
      });
    }
  }
  return rows;
}
