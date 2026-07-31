const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const { db, init, reset, TASK_COLUMNS } = require('./db');

init();

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

function toTask(row) {
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function likePattern(needle) {
  return '%' + String(needle).replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}

app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks', '/stats', '/reset'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// listing tasks
app.get('/tasks', (req, res) => {
  const { done, search, sort } = req.query;

  const where = [];
  const params = [];

  if (done !== undefined) {
    if (done !== 'true' && done !== 'false') {
      return res.status(400).json({ error: "Query param 'done' must be 'true' or 'false'" });
    }
    where.push('done = ?');
    params.push(done === 'true' ? 1 : 0);
  }

  if (search !== undefined && search !== '') {
    where.push("title LIKE ? ESCAPE '\\'");
    params.push(likePattern(search));
  }

  let orderBy = 'id';
  if (sort !== undefined) {
    if (sort !== 'title') {
      return res.status(400).json({ error: 'invalid sort value' });
    }
    orderBy = 'title COLLATE NOCASE ASC, id';
  }

  const sql =
    `SELECT ${TASK_COLUMNS} FROM tasks` +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY ' +
    orderBy;

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(toTask));
});

// counting tasks
app.get('/stats', (req, res) => {
  const stats = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN done = 1 THEN 1 END) AS done,
         COUNT(CASE WHEN done = 0 THEN 1 END) AS open
       FROM tasks`
    )
    .get();
  res.json(stats);
});

app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);
  if (!row) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.json(toTask(row));
});

// inserting a task
app.post('/tasks', (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }

  const info = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)').run(title.trim());
  const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(toTask(row));
});

// updating a task
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);
  if (!existing) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }

  const { title, done } = req.body || {};

  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'Title must be a non-empty string' });
  }
  if (done !== undefined && typeof done !== 'boolean') {
    return res.status(400).json({ error: 'Done must be a boolean' });
  }
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Provide at least one field to update: title or done' });
  }

  const sets = [];
  const params = [];
  if (title !== undefined) {
    sets.push('title = ?');
    params.push(title.trim());
  }
  if (done !== undefined) {
    sets.push('done = ?');
    params.push(done ? 1 : 0);
  }
  sets.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);
  res.json(toTask(row));
});

// deleting a task
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.status(204).end();
});

// resetting the tasks table
app.post('/reset', (req, res) => {
  reset();
  const rows = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY id`).all();
  res.json(rows.map(toTask));
});

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
});
