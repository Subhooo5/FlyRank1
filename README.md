# Task API

A simple **CRUD REST API** for managing tasks, built with **Node.js** and **Express**.
Tasks are stored in a **SQLite** database (`tasks.db`) via
[better-sqlite3](https://github.com/WiseLibs/better-sqlite3), so data survives server
restarts. See [Database (SQLite)](#database-sqlite) below.

Each task has the shape:

```json
{ "id": 1, "title": "Buy groceries", "done": false }
```

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- npm (bundled with Node.js)

## Install

```bash
git clone https://github.com/<your-username>/FlyRank1.git
cd FlyRank1
npm install
```

## Run

```bash
node server.js
```

The server starts on **http://localhost:3000**.

Interactive Swagger documentation is available at **http://localhost:3000/docs**.

## Endpoints

| Method | Path          | Description                        | Success | Errors   |
|--------|---------------|------------------------------------|---------|----------|
| GET    | `/`           | API info (name, version, endpoints)| 200     | —        |
| GET    | `/health`     | Health check                       | 200     | —        |
| GET    | `/tasks`      | List all tasks (optional `?done=` / `?search=`) | 200 | 400 |
| GET    | `/tasks/:id`  | Get a single task by ID            | 200     | 404      |
| POST   | `/tasks`      | Create a task (`title` required)   | 201     | 400      |
| PUT    | `/tasks/:id`  | Update a task (`title` / `done`)   | 200     | 400, 404 |
| DELETE | `/tasks/:id`  | Delete a task                      | 204     | 404      |
| GET    | `/stats`      | Task counts (`total` / `done` / `open`) | 200 | —      |
| POST   | `/reset`      | Reset store to the original 3 tasks | 200    | —        |

### Error format

Errors return a JSON body of the form:

```json
{ "error": "Task 99 not found" }
```

## Sample request & response

Request:

```bash
curl -i http://localhost:3000/tasks/1
```

Response:

```
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 45
ETag: W/"2d-Gv8HDdZD1sn+UqMseo56OTgQmek"
Date: Tue, 21 Jul 2026 17:16:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"title":"Buy groceries","done":false}
```

### More examples

```bash
# Create a task
curl -i -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn Express"}'

# Update a task
curl -i -X PUT http://localhost:3000/tasks/1 \
  -H 'Content-Type: application/json' \
  -d '{"done":true}'

# Delete a task
curl -i -X DELETE http://localhost:3000/tasks/1
```

## Optional

These optional extras were added on top of the core CRUD API:

- **Filtering** — `GET /tasks?done=true` (or `?done=false`) returns only tasks with that completion status.
- **Search** — `GET /tasks?search=word` returns tasks whose title contains `word` (case-insensitive). Filtering and search can be combined, e.g. `?done=false&search=call`.
- **Stats** — `GET /stats` returns `{ "total", "done", "open" }` counts computed with SQL `COUNT()` over the `tasks` table.
- **Reset** — `POST /reset` clears the `tasks` table, re-inserts the original 3 example tasks, and returns the reset list.

One example curl per extra:

```bash
# Filtering — only completed tasks
curl -i "http://localhost:3000/tasks?done=true"

# Search — tasks whose title contains "call"
curl -i "http://localhost:3000/tasks?search=call"

# Stats — counts of total/done/open
curl -i http://localhost:3000/stats

# Reset — restore the original 3 example tasks
curl -i -X POST http://localhost:3000/reset
```

### Mortality experiment (Assignment 1 — no longer applies)

> This experiment describes the original in-memory version of the API. Since the
> migration to SQLite (below), created tasks **do** survive a restart.

After creating a couple of extra tasks via `POST /tasks` and confirming they appeared in `GET /tasks`, the server process was stopped and restarted, and `GET /tasks` then showed only the original 3 seed tasks — the newly created ones were gone. This happens because the tasks live only in a JavaScript array in the running process's memory (there is no database or file persistence), so all runtime changes are lost the moment the process exits and the array is re-seeded on the next startup.

## API documentation (Swagger UI)

Interactive documentation is served at [http://localhost:3000/docs](http://localhost:3000/docs),
generated from [`openapi.json`](./openapi.json).

<!-- Replace the placeholder below with a real screenshot of the Swagger UI.
     Save the image as docs/swagger-screenshot.png and it will render here. -->

## Swagger UI screenshot
<img width="734" height="661" alt="swagger-screenshot" src="https://github.com/user-attachments/assets/99301951-112a-4783-803b-4b89217c720f" />


## Database (SQLite)

Tasks now live in a real database instead of a JavaScript array. Every endpoint
(`GET`, `POST`, `PUT`, `DELETE`, `/stats`, `/reset`) runs SQL against it — the request
and response formats are unchanged from Assignment 1.

### Why SQLite?

- **Zero setup** — no server process, no credentials, no Docker. The database is a
  single file, so `npm install && node server.js` is still all it takes to run the project.
- **Real SQL** — full `SELECT` / `INSERT` / `UPDATE` / `DELETE`, `WHERE`, `LIKE` and
  `COUNT()`, so the filtering and stats features moved straight from JavaScript into SQL.
- **Persistence** — data survives restarts and crashes, which was the whole point of
  the migration.
- **Right size for the job** — a single-user learning API doesn't need PostgreSQL or
  MySQL; SQLite is the standard choice for embedded, file-backed storage.
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** is used as the driver:
  it is synchronous, which keeps the route handlers simple and readable.

### Where the database lives

| | |
|---|---|
| File | `tasks.db` |
| Path | project root, i.e. `<repo>/tasks.db` (resolved from `__dirname` in [`db.js`](./db.js)) |
| Table | `tasks` |

The file is **not committed to git** (it is listed in `.gitignore`) — only the code that
creates it is. On first run the app creates `tasks.db`, creates the `tasks` table if it
doesn't exist, and inserts the 3 example tasks **only if the table is empty**, so
restarting never duplicates the seed data.

Schema:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT    NOT NULL,
  done  INTEGER NOT NULL DEFAULT 0   -- 0 = open, 1 = done
);
```

SQLite has no boolean type, so `done` is stored as `0`/`1` and converted back to
`true`/`false` in the JSON responses.

### How to start the project

Unchanged from Assignment 1:

```bash
npm install
node server.js
```

The database file is created automatically on first start — there is no migration step.

### Inspecting the database

With the `sqlite3` CLI:

```bash
# All tasks
sqlite3 tasks.db "SELECT * FROM tasks;"

# Only completed tasks
sqlite3 tasks.db "SELECT * FROM tasks WHERE done = 1;"

# How many tasks are stored
sqlite3 tasks.db "SELECT COUNT(*) FROM tasks;"
```

Example output:

```
id  title                 done
--  --------------------  ----
1   Buy groceries         0
2   Write project report  1
3   Call the dentist      0
```

Or open `tasks.db` in [DB Browser for SQLite](https://sqlitebrowser.org/) and use the
**Browse Data** tab.

<!-- Placeholder: add a screenshot of tasks.db open in DB Browser for SQLite here.
     Save the image as docs/db-browser-screenshot.png and reference it below. -->

### Database viewer screenshot

_Screenshot placeholder — `tasks.db` opened in DB Browser for SQLite (to be added)._

## Project structure

```
.
├── server.js       # Express app and all routes (SQL queries)
├── db.js           # SQLite connection, table creation, seeding and reset
├── tasks.db        # SQLite database file (created at runtime, git-ignored)
├── openapi.json    # OpenAPI 3.0 specification
├── package.json
└── README.md
```

## Notes

- Tasks are stored in the SQLite file `tasks.db`, so data persists across server restarts.
- IDs auto-increment and are not reused after deletion. `POST /reset` empties the table and
  restarts IDs from 1.
