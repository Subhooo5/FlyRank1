const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SEED_TASKS = [
  { title: 'Buy groceries', done: false },
  { title: 'Write project report', done: true },
  { title: 'Call the dentist', done: false },
];

const TASK_COLUMNS = `
  id,
  title,
  done,
  to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
  to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
`;

const INT4_MAX = 2147483647;

function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ids outside Postgres' integer range would raise a query error, so they are
// treated as "no such row" the way the previous SQLite lookups behaved
function isUsableId(id) {
  return Number.isInteger(id) && Math.abs(id) <= INT4_MAX;
}

function likePattern(needle) {
  return '%' + String(needle).replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}

async function init() {
  // creating the tasks table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM tasks');
  if (rows[0].count === 0) {
    await seed();
  }
}

// inserting the example tasks
async function seed(client = pool) {
  for (const task of SEED_TASKS) {
    await client.query('INSERT INTO tasks (title, done) VALUES ($1, $2)', [task.title, task.done]);
  }
}

// listing tasks
async function listTasks({ done, search, sort } = {}) {
  const where = [];
  const params = [];

  if (done !== undefined) {
    params.push(done);
    where.push(`done = $${params.length}`);
  }

  if (search !== undefined && search !== '') {
    params.push(likePattern(search));
    where.push(`title ILIKE $${params.length} ESCAPE '\\'`);
  }

  const orderBy = sort === 'title' ? 'LOWER(title) ASC, id' : 'id';

  const { rows } = await pool.query(
    `SELECT ${TASK_COLUMNS} FROM tasks` +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ` ORDER BY ${orderBy}`,
    params
  );
  return rows.map(toTask);
}

async function getTask(id) {
  if (!isUsableId(id)) return null;
  const { rows } = await pool.query(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`, [id]);
  return rows[0] ? toTask(rows[0]) : null;
}

// inserting a task
async function createTask(title) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, done) VALUES ($1, false) RETURNING ${TASK_COLUMNS}`,
    [title]
  );
  return toTask(rows[0]);
}

// updating a task
async function updateTask(id, { title, done }) {
  if (!isUsableId(id)) return null;

  const sets = [];
  const params = [];

  if (title !== undefined) {
    params.push(title);
    sets.push(`title = $${params.length}`);
  }
  if (done !== undefined) {
    params.push(done);
    sets.push(`done = $${params.length}`);
  }
  sets.push('updated_at = now()');
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${TASK_COLUMNS}`,
    params
  );
  return rows[0] ? toTask(rows[0]) : null;
}

// deleting a task
async function deleteTask(id) {
  if (!isUsableId(id)) return false;
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return rowCount > 0;
}

async function stats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE done)::int AS done,
      COUNT(*) FILTER (WHERE NOT done)::int AS open
    FROM tasks
  `);
  return rows[0];
}

// clearing the table and re-inserting the example tasks
async function reset() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tasks');
    await client.query('ALTER SEQUENCE tasks_id_seq RESTART WITH 1');
    await seed(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY id`);
  return rows.map(toTask);
}

async function ping() {
  await pool.query('SELECT 1');
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  init,
  seed,
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  stats,
  reset,
  ping,
  close,
};
