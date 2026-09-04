# Feynman Backend

Spring Boot service that evaluates a user's notebooks/pages and scores how well
each topic appears to be **understood**, following the Feynman technique: if you
can explain something simply and completely, you understand it well.

It replaces the frontend's hard-coded `progress.ts` placeholder values with real,
LLM-evaluated (or heuristic) scores.

## API

### `POST /api/evaluate`

Request body:

```json
{
  "notebooks": [{ "id": "nb-study", "title": "Study", "color": "#c94f0c" }],
  "pages": [
    {
      "id": "pg-feynman",
      "notebookId": "nb-study",
      "parentId": null,
      "title": "Feynman Technique",
      "content": "Pick a concept, teach it simply, identify gaps...",
      "boxes": [],
      "order": 0
    }
  ],
  "notebookId": "nb-study"
}
```

- `notebookId` is **optional**. When present, only that notebook and its pages
  are evaluated.

Response body:

```json
{
  "pageScores": {
    "pg-feynman": {
      "score": 88,
      "understandingNotes": "Clear, structured steps.",
      "feedback": "You explain each step of the technique clearly and in your own words. To go deeper, add a worked example of teaching a concept and note where you got stuck, since spotting gaps is the core of the method."
    }
  },
  "notebookScores": {
    "nb-study": {
      "score": 88,
      "understandingNotes": "Average understanding across 1 page(s).",
      "feedback": "Overall this notebook averages 88% understanding across 1 page(s). Open individual pages to see targeted feedback."
    }
  }
}
```

Each score carries a short `understandingNotes` (one-line badge tooltip) and a
longer, actionable `feedback` paragraph shown as a callout in the notebook UI.
Notebook scores are the average of their pages' scores.

## Running

```bash
cd backend
mvn spring-boot:run
```

The server listens on `http://localhost:8080` and allows CORS from the Vite dev
server (`http://localhost:5173`).

**A database is optional.** At startup the app probes the configured PostgreSQL
host/port:

- **reachable** → uses PostgreSQL and runs the Flyway migrations (data persists).
- **not reachable** → automatically falls back to an **in-memory H2** database
  (Flyway disabled, schema generated from the JPA entities) and prints a warning.
  Data is discarded when the process stops.

So on a machine without Docker or PostgreSQL, `mvn spring-boot:run` just works.
To disable the fallback and fail fast instead, set
`app.datasource.fallback-to-h2=false` (or `DB_FALLBACK_TO_H2=false`). The
fallback is also skipped automatically under the `prod` profile.

### Forcing H2

```bash
mvn spring-boot:run -Ph2
```

### Using PostgreSQL (persistent data)

With Docker, from the repository root:

```bash
docker compose up -d
```

This starts `postgres:16` with database/user/password `feynman`, matching the
defaults in `application.yml` (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`).
Without Docker, create the database once in a local PostgreSQL install:

```sql
CREATE USER feynman WITH PASSWORD 'feynman';
CREATE DATABASE feynman OWNER feynman;
```

### Helper scripts

From the repository root, `./run-backend.ps1` (Windows) or `./run-backend.sh`
(macOS/Linux) probe the database and start the backend with the matching profile.


### With OpenAI (real grading)

Set an API key before starting:

```bash
# Windows (cmd.exe)
set OPENAI_API_KEY=sk-...
mvn spring-boot:run
```

Optional overrides: `OPENAI_MODEL` (default `gpt-5.5`), `OPENAI_BASE_URL`.

### Without a key (offline mock)

If `OPENAI_API_KEY` is empty (or `OPENAI_MOCK=true`), the service returns
**deterministic** heuristic scores based on note length, so the app runs fully
offline. No key required.

## Tests

```bash
mvn test
```

The service's mock scoring path is covered without needing an API key.

