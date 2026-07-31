const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'tasks.db');

const db = new Database(DB_PATH);

const SEED_TASKS = [
  { title: 'Buy groceries', done: 0 },
  { title: 'Write project report', done: 1 },
  { title: 'Call the dentist', done: 0 },
];

const TASK_COLUMNS = 'id, title, done, created_at, updated_at';

function init() {
  // creating the tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  addTimestampColumns();

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
  if (count === 0) {
    seed();
  }
}

// adding timestamp columns to older databases
function addTimestampColumns() {
  const columns = db
    .prepare('PRAGMA table_info(tasks)')
    .all()
    .map((c) => c.name);

  for (const column of ['created_at', 'updated_at']) {
    if (!columns.includes(column)) {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
      db.exec(`UPDATE tasks SET ${column} = datetime('now') WHERE ${column} = ''`);
    }
  }
}

// inserting the example tasks
function seed() {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row.title, row.done);
  });
  insertAll(SEED_TASKS);
}

// clearing the table and re-inserting the example tasks
function reset() {
  const run = db.transaction(() => {
    db.prepare('DELETE FROM tasks').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'tasks'").run();
    seed();
  });
  run();
}

module.exports = { db, init, seed, reset, DB_PATH, TASK_COLUMNS };
