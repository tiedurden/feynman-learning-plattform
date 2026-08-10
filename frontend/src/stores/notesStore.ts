import { defineStore } from 'pinia'
import type { Notebook, Page, PageNode, TextBox } from '@/types'
import { seedNotebooks, seedPages } from '@/data/seed'

const STORAGE_KEY = 'onenote-notes:v1'

interface PersistShape {
  notebooks: Notebook[]
  pages: Page[]
}

/** Ensure every page has a boxes[] array (older persisted data may lack it). */
function normalizePages(pages: Page[]): Page[] {
  return pages.map((p) => ({ ...p, boxes: Array.isArray(p.boxes) ? p.boxes : [] }))
}

function loadState(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape
      if (Array.isArray(parsed.notebooks) && Array.isArray(parsed.pages)) {
        return { notebooks: parsed.notebooks, pages: normalizePages(parsed.pages) }
      }
    }
  } catch {
    /* ignore malformed storage */
  }
  // Fallback to fresh seed data (deep-cloned so we never mutate the source).
  return {
    notebooks: structuredClone(seedNotebooks),
    pages: normalizePages(structuredClone(seedPages))
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

interface State {
  notebooks: Notebook[]
  pages: Page[]
}

export const useNotesStore = defineStore('notes', {
  state: (): State => {
    const { notebooks, pages } = loadState()
    return { notebooks, pages }
  },

  getters: {
    /** Pages belonging to a notebook. */
    pagesByNotebook: (state) => {
      return (notebookId: string): Page[] =>
        state.pages.filter((p) => p.notebookId === notebookId)
    },

    /** Look up a single page by id. */
    pageById: (state) => {
      return (pageId: string): Page | undefined =>
        state.pages.find((p) => p.id === pageId)
    },

    /** Look up a single notebook by id. */
    notebookById: (state) => {
      return (notebookId: string): Notebook | undefined =>
        state.notebooks.find((n) => n.id === notebookId)
    },

    /**
     * Build the nested page tree for a notebook from the flat `parentId` list.
     */
    pageTree: (state) => {
      return (notebookId: string): PageNode[] => {
        const nodes = new Map<string, PageNode>()
        const notebookPages = state.pages.filter((p) => p.notebookId === notebookId)

        for (const p of notebookPages) {
          nodes.set(p.id, { ...p, children: [] })
        }

        const roots: PageNode[] = []
        for (const node of nodes.values()) {
          if (node.parentId && nodes.has(node.parentId)) {
            nodes.get(node.parentId)!.children.push(node)
          } else {
            roots.push(node)
          }
        }

        const sortRec = (list: PageNode[]) => {
          list.sort((a, b) => a.order - b.order)
          list.forEach((n) => sortRec(n.children))
        }
        sortRec(roots)

        return roots
      }
    }
  },

  actions: {
    persist() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ notebooks: this.notebooks, pages: this.pages })
        )
      } catch {
        /* storage might be unavailable — non-fatal */
      }
    },

    // --- Notebook CRUD -------------------------------------------------------
    addNotebook(title = 'New Notebook', color = '#7719aa'): Notebook {
      const notebook: Notebook = { id: uid('nb'), title, color }
      this.notebooks.push(notebook)
      this.persist()
      return notebook
    },

    renameNotebook(id: string, title: string) {
      const nb = this.notebooks.find((n) => n.id === id)
      if (nb) {
        nb.title = title
        this.persist()
      }
    },

    deleteNotebook(id: string) {
      this.notebooks = this.notebooks.filter((n) => n.id !== id)
      this.pages = this.pages.filter((p) => p.notebookId !== id)
      this.persist()
    },

    // --- Page CRUD -----------------------------------------------------------
    addPage(notebookId: string, parentId: string | null = null, title = 'Untitled Page'): Page {
      const siblings = this.pages.filter(
        (p) => p.notebookId === notebookId && p.parentId === parentId
      )
      const order = siblings.length
        ? Math.max(...siblings.map((s) => s.order)) + 1
        : 0
      const page: Page = {
        id: uid('pg'),
        notebookId,
        parentId,
        title,
        content: '',
        boxes: [],
        order
      }
      this.pages.push(page)
      this.persist()
      return page
    },

    updatePage(id: string, patch: Partial<Pick<Page, 'title' | 'content'>>) {
      const page = this.pages.find((p) => p.id === id)
      if (page) {
        Object.assign(page, patch)
        this.persist()
      }
    },

    // --- Text box CRUD -------------------------------------------------------
    /** Persist a new (non-empty) text box onto a page. */
    addTextBox(pageId: string, box: Omit<TextBox, 'id'>): TextBox | undefined {
      const page = this.pages.find((p) => p.id === pageId)
      if (!page) return
      if (!page.boxes) page.boxes = []
      const tb: TextBox = { id: uid('tb'), ...box }
      page.boxes.push(tb)
      this.persist()
      return tb
    },

    updateTextBox(
      pageId: string,
      boxId: string,
      patch: Partial<Pick<TextBox, 'text' | 'x' | 'y' | 'width'>>
    ) {
      const page = this.pages.find((p) => p.id === pageId)
      const box = page?.boxes?.find((b) => b.id === boxId)
      if (box) {
        Object.assign(box, patch)
        this.persist()
      }
    },

    /** Remove a text box (used when it is emptied out). */
    removeTextBox(pageId: string, boxId: string) {
      const page = this.pages.find((p) => p.id === pageId)
      if (page?.boxes) {
        page.boxes = page.boxes.filter((b) => b.id !== boxId)
        this.persist()
      }
    },

    /** Delete a page and all of its descendants. */
    deletePage(id: string) {
      const toRemove = new Set<string>([id])
      let changed = true
      while (changed) {
        changed = false
        for (const p of this.pages) {
          if (p.parentId && toRemove.has(p.parentId) && !toRemove.has(p.id)) {
            toRemove.add(p.id)
            changed = true
          }
        }
      }
      this.pages = this.pages.filter((p) => !toRemove.has(p.id))
      this.persist()
    },

    /** Re-parent a page (e.g. drag & drop). Guards against cycles. */
    movePage(id: string, newParentId: string | null) {
      if (id === newParentId) return
      // Prevent moving a page under one of its own descendants.
      let cursor = newParentId
      while (cursor) {
        if (cursor === id) return
        cursor = this.pages.find((p) => p.id === cursor)?.parentId ?? null
      }
      const page = this.pages.find((p) => p.id === id)
      if (page) {
        page.parentId = newParentId
        this.persist()
      }
    },

    resetToSeed() {
      this.notebooks = structuredClone(seedNotebooks)
      this.pages = normalizePages(structuredClone(seedPages))
      this.persist()
    }
  }
})

