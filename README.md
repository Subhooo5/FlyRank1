# Task API

A simple **CRUD REST API** for managing tasks, built with **Node.js** and **Express**.
Tasks are stored in a **PostgreSQL** database running in Docker, accessed with the
[`pg`](https://node-postgres.com/) driver. The whole stack — API plus database — starts with a
single `docker compose up`. See [Database (PostgreSQL in Docker)](#database-postgresql-in-docker) below.

Each task has the shape:

```json
{
  "id": 1,
  "title": "Buy groceries",
  "done": false,
  "created_at": "2026-07-30 16:21:01",
  "updated_at": "2026-07-30 16:21:01"
}
```

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — the only requirement for
  the one-command run below
- [Node.js](https://nodejs.org/) 18 or newer and npm — only if you want to run the API outside
  a container

## Run the whole stack with one command

```bash
git clone https://github.com/<your-username>/FlyRank1.git
cd FlyRank1
docker compose up
```

That builds the API image and starts two services defined in [`compose.yaml`](./compose.yaml):

| Service | What it is | Address |
|---------|------------|---------|
| `api`   | this Express app | http://localhost:3000 |
| `db`    | `postgres:16`, container `flyrank-db` | `localhost:5432` |

The API waits for the database's `pg_isready` healthcheck before starting, creates the `tasks`
table if it doesn't exist, and seeds 3 example tasks the first time only. Data lives in the
named volume `flyrank-data`, so `docker compose down` followed by `docker compose up` keeps
every task. Stop the stack with `docker compose down` (add `-v` to also delete the data).

Interactive Swagger documentation is available at **http://localhost:3000/docs**.

### Environment variables

Copy [`.env.example`](./.env.example) to `.env` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | Postgres connection string | `postgres://postgres:dev@localhost:5432/tasks` |
| `PORT` | Port the API listens on | `3000` |

`.env` holds real credentials and is git-ignored — only `.env.example` is committed. Under
`docker compose` these values come from `compose.yaml` instead, where the host is `db` rather
than `localhost`.

### Running the API outside Docker

Start just the database in Docker, then run the app on your machine:

```bash
docker compose up -d db
npm install
node server.js
```

## Endpoints

| Method | Path          | Description                        | Success | Errors   |
|--------|---------------|------------------------------------|---------|----------|
| GET    | `/`           | API info (name, version, endpoints)| 200     | —        |
| GET    | `/health`     | Health check — runs `SELECT 1` against the DB, returns `{ status, db }` | 200 | 503 |
| GET    | `/tasks`      | List all tasks (optional `?done=` / `?search=` / `?sort=`) | 200 | 400 |
| GET    | `/tasks/:id`  | Get a single task by ID            | 200     | 404      |
| POST   | `/tasks`      | Create a task (`title` required)   | 201     | 400      |
| PUT    | `/tasks/:id`  | Update a task (`title` / `done`)   | 200     | 400, 404 |
| DELETE | `/tasks/:id`  | Delete a task                      | 204     | 404      |
| GET    | `/stats`      | Task counts (`total` / `done` / `open`) | 200 | —      |
| POST   | `/reset`      | Reset store to the original 3 tasks | 200    | —        |
| GET    | `/docs`       | Swagger UI, generated from `openapi.json` | 200 | —     |

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
Content-Length: 115
ETag: W/"73-Fl3hfrZMXMmzU6clbLizJeq6s2c"
Date: Fri, 31 Jul 2026 17:25:49 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"title":"Buy groceries","done":false,"created_at":"2026-07-31 17:25:49","updated_at":"2026-07-31 17:25:49"}
```

(Captured against the stack started with `docker compose up`.)

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

- **Filtering** — `GET /tasks?done=true` (or `?done=false`) returns only tasks with that completion status, via a SQL `WHERE` clause.
- **Search** — `GET /tasks?search=word` returns tasks whose title contains `word` (case-insensitive), via SQL `LIKE`.
- **Sort alphabetically** — `GET /tasks?sort=title` returns tasks ordered by title, ignoring case (`ORDER BY title COLLATE NOCASE`). Without `?sort=` the default id order is kept; any other value returns `400 { "error": "invalid sort value" }`. Filtering, search and sort can all be combined, e.g. `?done=false&search=call&sort=title`.
- **Timestamps** — every task stores `created_at` and `updated_at` (`YYYY-MM-DD HH:MM:SS`, UTC). `created_at` is set once on insert; `updated_at` is refreshed by every successful `PUT`.
- **Stats** — `GET /stats` returns `{ "total", "done", "open" }` counts computed with SQL `COUNT()` over the `tasks` table.
- **Reset** — `POST /reset` clears the `tasks` table, re-inserts the original 3 example tasks, and returns the reset list.
- **Real health check** — `GET /health` runs `SELECT 1` against Postgres and returns
  `{ "status": "ok", "db": "ok" }`, or `503` with `{ "status": "error", "db": "error" }` when the
  database is unreachable. The API stays up either way, so it recovers on its own once the
  database comes back.

One example curl per extra:

```bash
# Filtering — only completed tasks
curl -i "http://localhost:3000/tasks?done=true"

# Search — tasks whose title contains "call"
curl -i "http://localhost:3000/tasks?search=call"

# Sort — tasks ordered alphabetically by title
curl -i "http://localhost:3000/tasks?sort=title"

# Stats — counts of total/done/open
curl -i http://localhost:3000/stats

# Reset — restore the original 3 example tasks
curl -i -X POST http://localhost:3000/reset
```

### Mortality experiment (Assignment 1 — no longer applies)

> This experiment describes the original in-memory version of the API. Since the migration to
> a database (SQLite in Assignment 2, PostgreSQL now), created tasks **do** survive a restart.
> See [Mortality experiment, part two](#mortality-experiment-part-two) for the Docker version.

After creating a couple of extra tasks via `POST /tasks` and confirming they appeared in `GET /tasks`, the server process was stopped and restarted, and `GET /tasks` then showed only the original 3 seed tasks — the newly created ones were gone. This happens because the tasks live only in a JavaScript array in the running process's memory (there is no database or file persistence), so all runtime changes are lost the moment the process exits and the array is re-seeded on the next startup.

## API documentation (Swagger UI)

Interactive documentation is served at [http://localhost:3000/docs](http://localhost:3000/docs),
generated from [`openapi.json`](./openapi.json).

<!-- Replace the placeholder below with a real screenshot of the Swagger UI.
     Save the image as docs/swagger-screenshot.png and it will render here. -->

## Swagger UI screenshot
<img width="734" height="661" alt="swagger-screenshot" src="https://github.com/user-attachments/assets/99301951-112a-4783-803b-4b89217c720f" />

## Database (PostgreSQL in Docker)

### What changed

Storage moved from a local **SQLite** file (`tasks.db`, driver `better-sqlite3`) to a
**containerized PostgreSQL** database (driver [`pg`](https://node-postgres.com/)). The API
itself is unchanged from the client's point of view — same paths, same status codes, same
error message wording, same `?done=` / `?search=` / `?sort=` extras, same task JSON.

| | Before (Assignment 2) | Now (Assignment 3) |
|---|---|---|
| Database | SQLite file `tasks.db` | PostgreSQL 16 in Docker |
| Driver | `better-sqlite3` (synchronous) | `pg` connection pool (async) |
| Where data lives | a file in the repo | named Docker volume `flyrank-data` |
| Booleans | `0` / `1` integers | native `BOOLEAN` |
| Ids | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| Case-insensitive search | `LIKE` (ASCII-insensitive by default) | `ILIKE` |
| Alphabetical sort | `ORDER BY title COLLATE NOCASE` | `ORDER BY LOWER(title)` |
| Config | hard-coded path | `DATABASE_URL` from `.env` |
| Start command | `node server.js` | `docker compose up` |

Every SQL statement lives in [`db.js`](./db.js); [`server.js`](./server.js) only validates
input, awaits those functions and picks status codes.

### Why PostgreSQL?

- **Concurrent access** — a real server process handles many clients at once, where a SQLite
  file locks on write.
- **Runs as its own service** — the database is no longer bound to the app's filesystem, which
  is what makes the two-container compose setup possible.
- **Richer SQL** — `RETURNING *`, `COUNT(*) FILTER (WHERE ...)`, `ILIKE` and real sequences
  replaced workarounds needed under SQLite.
- **Same setup everywhere** — the image pins an exact version, so every machine runs the same
  database instead of "whatever SQLite ships with this Node build".

### Schema

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

`created_at` is set once on insert; `updated_at` is refreshed by every successful `PUT`. Both
are rendered as `YYYY-MM-DD HH:MM:SS` in JSON responses, matching the previous format.
`POST /reset` clears the table inside a transaction, runs
`ALTER SEQUENCE tasks_id_seq RESTART WITH 1` and re-seeds, so ids start again at 1.

### Running Postgres without compose

Compose is the normal path, but a standalone container works too:

```bash
docker run --name flyrank-db \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=tasks \
  -p 5432:5432 \
  -v flyrank-data:/var/lib/postgresql/data \
  -d postgres:16
```

The image is pinned to `postgres:16` because `postgres:latest` (18 and up) stores data under a
different path and refuses a volume mounted at `/var/lib/postgresql/data`.

### Inspecting the database

```bash
# List tables
docker exec -it flyrank-db psql -U postgres -d tasks -c "\dt"

# All tasks
docker exec -it flyrank-db psql -U postgres -d tasks -c "SELECT * FROM tasks;"

# Only completed tasks
docker exec -it flyrank-db psql -U postgres -d tasks -c "SELECT * FROM tasks WHERE done;"

# How many tasks are stored
docker exec -it flyrank-db psql -U postgres -d tasks -c "SELECT COUNT(*) FROM tasks;"

# Or open an interactive session
docker exec -it flyrank-db psql -U postgres -d tasks
```

Example output:

```
 id |        title         | done |         created_at         |         updated_at
----+----------------------+------+----------------------------+----------------------------
  1 | Buy groceries        | f    | 2026-07-31 17:20:20.195433 | 2026-07-31 17:20:20.195433
  2 | Write project report | t    | 2026-07-31 17:20:20.195935 | 2026-07-31 17:20:20.195935
  3 | Call the dentist     | f    | 2026-07-31 17:20:20.196267 | 2026-07-31 17:20:20.196267
(3 rows)
```

Any Postgres GUI (TablePlus, pgAdmin, DBeaver, DataGrip) can connect to `localhost:5432` with
user `postgres`, password `dev`, database `tasks`.

<!-- Placeholder: add a screenshot of the database here — psql \dt output, or the tasks table
     open in a GUI. Save it as docs/postgres-screenshot.png and reference it below. -->

### Database screenshot

_Screenshot placeholder — output of `\dt` / the `tasks` table in a Postgres client (to be added)._

### Mortality experiment, part two

The data lives in the named volume `flyrank-data`, not in the container, which is why
`docker compose down` and then `docker compose up` brings every task back. Run the database
without a volume and the story is the old one — removing the container deletes its writable
layer, so all tasks vanish; `docker compose down -v` deletes the named volume and has the
same effect.

## Project structure

```
.
├── server.js       # Express app and all routes (validation, status codes)
├── db.js           # Postgres pool — every SQL statement lives here
├── compose.yaml    # api + db services, one-command stack
├── Dockerfile      # image for the api service
├── .dockerignore
├── .env.example    # placeholder env values (committed)
├── .env            # real env values (git-ignored)
├── openapi.json    # OpenAPI 3.0 specification
├── package.json
└── README.md
```

## Notes

- Tasks are stored in PostgreSQL, in the Docker volume `flyrank-data`, so data persists across
  restarts of both the app and the containers.
- IDs auto-increment and are not reused after deletion. `POST /reset` empties the table and
  restarts IDs from 1.

## Triage endpoint

POST /triage reads one task description and tells the app which kind of task it is (work, study, personal, shopping or other), how urgent it is, how sure it is, and why. It returns the same four fields every time. When the text is unclear it says "other" with low confidence instead of guessing.

### Try it

```
curl -i -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"Submit the quarterly report to my manager by tomorrow morning"}'
```

Exact response (paste your real one):

```
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 108
ETag: W/"6c-xQOzxU8bdqphe2j7jBdU5sYyhic"
Date: Thu, 08 Oct 2026 16:30:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"category":"work","priority":"high","confidence":0.95,"reason":"A work deliverable with a close deadline."}
```

Broken input:

```
curl -i -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d '{"wrong":"field"}'
```

Returns 400 with `{"error":"text: ..."}`.

### Job card

PASTE THE FULL CONTENT OF JOB-CARD.md HERE, including the "It must never" list.

### Provider

Provider: OpenRouter (or Ollama). Model: `openrouter/free` (or your model).
To swap provider or model, change only these three variables in `.env`: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.

Other variables: `LLM_STUB=1` returns a fake valid answer without calling a model, `LLM_ENABLED=false` is the kill switch, `PROMPT_VERSION` picks the prompt file.

### Setup and run

```
npm install
cp .env.example .env
npm start
```

Fill `.env` with your own `DATABASE_URL` and LLM values first (the existing Task API needs its database to start).

### Reliability

- 30 second timeout on every model call, returned as 504
- Retries on timeouts, 429 and 5xx with exponential backoff and jitter, honouring Retry-After; never on 400, 401 or 403
- SDK retries are off (`maxRetries: 0`), my own retry logic is used instead
- Invalid model output gets one repair retry, then 422 and a line in `logs/quarantine.jsonl`
- Raw model text is never returned to the caller

### Eval result

date=2026-10-08 prompt=v1 model=openrouter/free
score=8/8 (100%)
failed: []

### Cost log (one call)

```
api-1  | {"time":"2026-10-08T16:25:34.663Z","event":"llm_call","promptVersion":"v1","model":"openrouter/free","inputTokens":411,"outputTokens":96,"durationMs":1658,"repaired":0,"failed":false}
```

Estimate: (input tokens + output tokens) x 10,000 requests per day = TOTAL tokens per day. Free models cost $0, and at a paid model's price from the LLM price calculator that is about $COST per day.