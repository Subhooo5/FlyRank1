const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Original example tasks, used to seed and to reset the store
function seedTasks() {
  return [
    { id: 1, title: 'Buy groceries', done: false },
    { id: 2, title: 'Write project report', done: true },
    { id: 3, title: 'Call the dentist', done: false },
  ];
}

// In-memory data store
let tasks = seedTasks();
let nextId = 4;

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
  let result = tasks;

  const { done, search } = req.query;

  if (done !== undefined) {
    if (done !== 'true' && done !== 'false') {
      return res.status(400).json({ error: "Query param 'done' must be 'true' or 'false'" });
    }
    const wantDone = done === 'true';
    result = result.filter((t) => t.done === wantDone);
  }

  if (search !== undefined && search !== '') {
    const needle = String(search).toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(needle));
  }

  res.json(result);
});

// Getting a single task by id
app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.json(task);
});

// Creating a new task
app.post('/tasks', (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }
  const task = { id: nextId++, title: title.trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
});

// Updating an existing task
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);
  if (!task) {
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

  if (title !== undefined) task.title = title.trim();
  if (done !== undefined) task.done = done;

  res.json(task);
});

// Deleting a task
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  tasks.splice(index, 1);
  res.status(204).end();
});

// Task statistics
app.get('/stats', (req, res) => {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  res.json({ total, done, open: total - done });
});

// Reset the store back to the original 3 example tasks
app.post('/reset', (req, res) => {
  tasks = seedTasks();
  nextId = 4;
  res.json(tasks);
});

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
});
