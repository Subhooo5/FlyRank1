const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const { db, init, reset } = require('./db');

// Create the tasks table if needed and seed it on first run only
init();

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// SQLite stores booleans as 0/1, so rows are mapped back to the JSON shape
// the API has always returned: { id, title, done: true|false }
function toTask(row) {
  return { id: row.id, title: row.title, done: Boolean(row.done) };
}

// Escape LIKE wildcards so ?search=100% matches literally, like the old
// JavaScript substring filter did
function likePattern(needle) {
  return '%' + String(needle).replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}

app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Listing all tasks, with optional ?done= and ?search= filters (combinable)
app.get('/tasks', (req, res) => {
  const { done, search } = req.query;

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
    // LIKE is case-insensitive for ASCII in SQLite, matching the old behaviour
    where.push("title LIKE ? ESCAPE '\\'");
    params.push(likePattern(search));
  }

  const sql =
    'SELECT id, title, done FROM tasks' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY id';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(toTask));
});

// Getting a single task by id
app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.json(toTask(row));
});

// Creating a new task
app.post('/tasks', (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }
  const info = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)').run(title.trim());
  const row = db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(toTask(row));
});

// Updating an existing task
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(id);
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
  params.push(id);

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(id);
  res.json(toTask(row));
});

// Deleting a task
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.status(204).end();
});

// Task statistics, counted by SQL
app.get('/stats', (req, res) => {
  const { total, done } = db
    .prepare('SELECT COUNT(*) AS total, COUNT(CASE WHEN done = 1 THEN 1 END) AS done FROM tasks')
    .get();
  res.json({ total, done, open: total - done });
});

// Reset the table back to the original 3 example tasks
app.post('/reset', (req, res) => {
  reset();
  const rows = db.prepare('SELECT id, title, done FROM tasks ORDER BY id').all();
  res.json(rows.map(toTask));
});

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
});
