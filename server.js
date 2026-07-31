require('dotenv').config();

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks', '/stats', '/reset'],
  });
});

app.get('/health', async (req, res) => {
  try {
    await db.ping();
  } catch (err) {
    return res.status(503).json({ status: 'error', db: 'error' });
  }
  res.json({ status: 'ok', db: 'ok' });
});

// listing tasks
app.get('/tasks', async (req, res) => {
  const { done, search, sort } = req.query;

  if (done !== undefined && done !== 'true' && done !== 'false') {
    return res.status(400).json({ error: "Query param 'done' must be 'true' or 'false'" });
  }
  if (sort !== undefined && sort !== 'title') {
    return res.status(400).json({ error: 'invalid sort value' });
  }

  const tasks = await db.listTasks({
    done: done === undefined ? undefined : done === 'true',
    search,
    sort,
  });
  res.json(tasks);
});

app.get('/stats', async (req, res) => {
  res.json(await db.stats());
});

app.get('/tasks/:id', async (req, res) => {
  const task = await db.getTask(Number(req.params.id));
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.json(task);
});

// inserting a task
app.post('/tasks', async (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }

  const task = await db.createTask(title.trim());
  res.status(201).json(task);
});

// updating a task
app.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.getTask(id);
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

  const task = await db.updateTask(id, {
    title: title === undefined ? undefined : title.trim(),
    done,
  });
  res.json(task);
});

// deleting a task
app.delete('/tasks/:id', async (req, res) => {
  const deleted = await db.deleteTask(Number(req.params.id));
  if (!deleted) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.status(204).end();
});

// resetting the tasks table
app.post('/reset', async (req, res) => {
  res.json(await db.reset());
});

async function start() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`Task API listening on http://localhost:${PORT}`);
  });
}

start();
