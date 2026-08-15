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
    "pg-feynman": { "score": 88, "understandingNotes": "Clear, structured steps." }
  },
  "notebookScores": {
    "nb-study": { "score": 88, "understandingNotes": "Average understanding across 1 page(s)." }
  }
}
```

Notebook scores are the average of their pages' scores.

## Running

```bash
cd backend
mvn spring-boot:run
```

The server listens on `http://localhost:8080` and allows CORS from the Vite dev
server (`http://localhost:5173`).

### With OpenAI (real grading)

Set an API key before starting:

```bash
# Windows (cmd.exe)
set OPENAI_API_KEY=sk-...
mvn spring-boot:run
```

Optional overrides: `OPENAI_MODEL` (default `gpt-4o-mini`), `OPENAI_BASE_URL`.

### Without a key (offline mock)

If `OPENAI_API_KEY` is empty (or `OPENAI_MOCK=true`), the service returns
**deterministic** heuristic scores based on note length, so the app runs fully
offline. No key required.

## Tests

```bash
mvn test
```

The service's mock scoring path is covered without needing an API key.

