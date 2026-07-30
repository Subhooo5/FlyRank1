const path = require('path');
const Database = require('better-sqlite3');

// The database file lives next to the code, at <project root>/tasks.db.
// better-sqlite3 creates the file automatically if it does not exist yet.
const DB_PATH = path.join(__dirname, 'tasks.db');

const db = new Database(DB_PATH);

// Original example tasks, used to seed the table and to serve POST /reset
const SEED_TASKS = [
  { title: 'Buy groceries', done: 0 },
  { title: 'Write project report', done: 1 },
  { title: 'Call the dentist', done: 0 },
];

// Create the table if it doesn't exist, then seed it only when it is empty,
// so restarting the app never duplicates the example tasks.
function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0
    )
  `);

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
  if (count === 0) {
    seed();
  }
}

// Insert the 3 example tasks. Used on first run and by POST /reset.
function seed() {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const insertAll = db.transaction((rows) => {
    for (const row of rows) insert.run(row.title, row.done);
  });
  insertAll(SEED_TASKS);
}

// Clear the table and re-insert the 3 example tasks, restarting ids at 1
function reset() {
  const run = db.transaction(() => {
    db.prepare('DELETE FROM tasks').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'tasks'").run();
    seed();
  });
  run();
}

module.exports = { db, init, seed, reset, DB_PATH };
