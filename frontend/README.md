# OneNote-Style Notes Frontend

A Vue 3 + Vite + TypeScript single-page app styled after Microsoft OneNote.
Three-pane layout: **Notebooks → nested Page tree → Note editor**.

## Stack
- Vue 3 (`<script setup>`, Composition API)
- Vite + TypeScript
- Vue Router (`/notebook/:id/page/:pageId`)
- Pinia store with tree-building helpers + `localStorage` persistence

## Data hierarchy
```
Notebook (1)
 └── Page (many, tree)
      ├── Page (child)
      │    └── Page (grandchild …)   ← recursive parentId
      └── Page (child)
```
- `Notebook { id, title, color }`
- `Page { id, notebookId, parentId|null, title, content, order, boxes[], images[] }`
  - `children[]` is derived at runtime (`PageNode`) by `notesStore.pageTree`.

## Images on pages

Use **Add image** in the page editor to upload a PNG, JPEG, or WebP image (up to
10 MB). The image is stored with its page and initially appears in the visible
center of the canvas. Drag it to reposition it; use the × control to remove it.
Uploaded images are served through the authenticated API and are not embedded
in text-box HTML.

## Getting started
```bash
cd frontend
npm install
npm run dev
```
Then open http://localhost:5173.

## Project structure
```
src/
  components/
    AppLayout.vue      # three-pane grid, route wiring
    NotebookList.vue   # pane 1 — notebooks
    PageTree.vue       # pane 2 — page tree container
    PageTreeItem.vue   # recursive nested page node
    NoteEditor.vue     # pane 3 — title + textarea editor
  data/seed.ts         # mock seed notebooks & pages
  stores/notesStore.ts # Pinia CRUD + pageTree helpers
  types/index.ts       # Notebook / Page / PageNode interfaces
  router/index.ts      # routes
  styles/main.css      # OneNote-like base theme
```

## Further considerations
1. **Editor richness** — currently a plain `<textarea>`; swap for
   `contenteditable` or Tiptap for rich text.
2. **Persistence** — mock data persisted to `localStorage`; replace with a
   REST/GraphQL backend later. `notesStore.resetToSeed()` restores defaults.
3. Keep all frontend code in this `frontend/` folder.
