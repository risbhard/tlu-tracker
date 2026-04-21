const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.TLU_DB_PATH || path.join(__dirname, '..', 'tlu-tracker.db');

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (e) {
  // ignore
}

console.log(`[db] Opening database at ${dbPath}`);

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT,
    tlu_count INTEGER NOT NULL DEFAULT 1,
    total_hours_allocation INTEGER,
    pin_prompt_shown INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hour_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    hours REAL NOT NULL,
    category TEXT,
    project_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    tlu_count REAL NOT NULL,
    hours_per_tlu REAL NOT NULL DEFAULT 128,
    total_hours REAL NOT NULL,
    archived INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_seconds REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Add columns if they don't exist (for existing databases)
try {
  db.prepare('ALTER TABLE users ADD COLUMN total_hours_allocation INTEGER').run();
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.prepare('ALTER TABLE hour_logs ADD COLUMN project_id INTEGER').run();
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.prepare('ALTER TABLE users ADD COLUMN pin_prompt_shown INTEGER DEFAULT 0').run();
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.prepare("ALTER TABLE hour_logs ADD COLUMN method TEXT DEFAULT 'manual'").run();
} catch (e) {
  // Column already exists, ignore error
}

module.exports = db;
