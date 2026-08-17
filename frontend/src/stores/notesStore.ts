import { defineStore } from 'pinia'
import type { Notebook, NotebookTree, Page, PageNode, TextBox, TextReference } from '@/types'
import { seedNotebooks, seedPages } from '@/data/seed'

const STORAGE_KEY = 'onenote-notes:v2'
/** Separate key for lightweight UI preferences (progress toggle, etc.). */
const UI_STORAGE_KEY = 'onenote-ui:v1'

interface PersistShape {
  notebooks: Notebook[]
  pages: Page[]
}

/** Ensure every page has a boxes[] array (older persisted data may lack it). */
function normalizePages(pages: Page[]): Page[] {
  return pages.map((p) => ({
    ...p,
    boxes: Array.isArray(p.boxes)
      ? p.boxes.map((b) => ({
          ...b,
          references: Array.isArray(b.references) ? b.references : []
        }))
      : []
  }))
}

/** Load persisted UI preferences (best-effort). */
function loadShowProgress(): boolean {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { showProgress?: boolean }
      return parsed.showProgress === true
    }
  } catch {
    /* ignore malformed storage */
  }
  return false
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
  /** Global toggle: show completion progress badges across all sidebars. */
  showProgress: boolean
}

export const useNotesStore = defineStore('notes', {
  state: (): State => {
    const { notebooks, pages } = loadState()
    return { notebooks, pages, showProgress: loadShowProgress() }
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
    },

    /**
     * Human-readable breadcrumb for a page: notebook title followed by every
     * ancestor page title and finally the page itself. Used for link tooltips.
     */
    pagePath(): (pageId: string) => string[] {
      return (pageId: string): string[] => {
        const page = this.pages.find((p) => p.id === pageId)
        if (!page) return []
        const titles: string[] = []
        let cursor: Page | undefined = page
        while (cursor) {
          titles.unshift(cursor.title || 'Untitled')
          cursor = cursor.parentId
            ? this.pages.find((p) => p.id === cursor!.parentId)
            : undefined
        }
        const notebook = this.notebooks.find((n) => n.id === page.notebookId)
        if (notebook) titles.unshift(notebook.title)
        return titles
      }
    },

    /** Every notebook paired with its resolved page tree (for the ref picker). */
    allNotebookTrees(): NotebookTree[] {
      return this.notebooks.map((notebook) => ({
        notebook,
        tree: this.pageTree(notebook.id)
      }))
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

    // --- UI preferences ------------------------------------------------------
    /** Toggle (or explicitly set) the global progress display. */
    setShowProgress(value?: boolean) {
      this.showProgress = value ?? !this.showProgress
      try {
        localStorage.setItem(
          UI_STORAGE_KEY,
          JSON.stringify({ showProgress: this.showProgress })
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
      const tb: TextBox = {
        id: uid('tb'),
        references: [],
        ...box,
        text: sanitizeBoxHtml(box.text ?? '')
      }
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
        // Sanitize incoming rich-text before it is stored/persisted.
        const cleanPatch =
          patch.text !== undefined
            ? { ...patch, text: sanitizeBoxHtml(patch.text) }
            : patch
        // When the text changes, drop any inline reference whose linked
        // substring no longer matches its recorded offsets (best-effort sync).
        if (
          cleanPatch.text !== undefined &&
          cleanPatch.text !== box.text &&
          box.references?.length
        ) {
          const oldText = box.text
          const newText = cleanPatch.text
          box.references = box.references.filter((ref) => {
            const oldSub = oldText.slice(ref.start, ref.end)
            return newText.slice(ref.start, ref.end) === oldSub
          })
        }
        Object.assign(box, cleanPatch)
        this.persist()
      }
    },

    /**
     * Add an inline page reference to a box. Optionally replaces the marked
     * range with `linkText` first (the modal lets the user edit the wording),
     * then records the reference over the resulting range.
     */
    addBoxReference(
      pageId: string,
      boxId: string,
      params: { start: number; end: number; targetPageId: string; linkText?: string }
    ): TextReference | undefined {
      const page = this.pages.find((p) => p.id === pageId)
      const box = page?.boxes?.find((b) => b.id === boxId)
      if (!box) return
      if (!box.references) box.references = []

      let { start, end } = params
      // Apply an (optional) text replacement for the linked range.
      if (params.linkText !== undefined && params.linkText !== box.text.slice(start, end)) {
        const before = box.text.slice(0, start)
        const after = box.text.slice(end)
        const newEnd = start + params.linkText.length
        // Shift any existing references that sit after the edited range.
        const delta = params.linkText.length - (end - start)
        box.references = box.references
          .filter((ref) => ref.end <= start || ref.start >= end) // drop overlaps
          .map((ref) =>
            ref.start >= end
              ? { ...ref, start: ref.start + delta, end: ref.end + delta }
              : ref
          )
        box.text = before + params.linkText + after
        end = newEnd
      }

      const reference: TextReference = {
        id: uid('ref'),
        start,
        end,
        targetPageId: params.targetPageId
      }
      // Replace any reference that overlaps the new range, then add.
      box.references = box.references.filter(
        (ref) => ref.end <= start || ref.start >= end
      )
      box.references.push(reference)
      box.references.sort((a, b) => a.start - b.start)
      this.persist()
      return reference
    },

    /** Remove a single inline reference from a box. */
    removeBoxReference(pageId: string, boxId: string, referenceId: string) {
      const page = this.pages.find((p) => p.id === pageId)
      const box = page?.boxes?.find((b) => b.id === boxId)
      if (box?.references) {
        box.references = box.references.filter((r) => r.id !== referenceId)
        this.persist()
      }
    },

    /**
     * Update an existing inline reference: optionally rewrite its linked text
     * (adjusting its own end offset and shifting later references) and/or point
     * it at a different page.
     */
    updateBoxReference(
      pageId: string,
      boxId: string,
      referenceId: string,
      patch: { linkText?: string; targetPageId?: string }
    ) {
      const page = this.pages.find((p) => p.id === pageId)
      const box = page?.boxes?.find((b) => b.id === boxId)
      const ref = box?.references?.find((r) => r.id === referenceId)
      if (!box || !ref) return

      // Rewrite the linked substring if the text changed.
      if (patch.linkText !== undefined && patch.linkText !== box.text.slice(ref.start, ref.end)) {
        const before = box.text.slice(0, ref.start)
        const after = box.text.slice(ref.end)
        const delta = patch.linkText.length - (ref.end - ref.start)
        box.text = before + patch.linkText + after
        // Shift references that sit entirely after the edited range.
        for (const other of box.references!) {
          if (other.id !== ref.id && other.start >= ref.end) {
            other.start += delta
            other.end += delta
          }
        }
        ref.end = ref.start + patch.linkText.length
      }

      if (patch.targetPageId !== undefined) {
        ref.targetPageId = patch.targetPageId
      }

      box.references!.sort((a, b) => a.start - b.start)
      this.persist()
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

