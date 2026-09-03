import { defineStore } from 'pinia'
import type { Notebook, NotebookTree, Page, PageNode, TextBox, TextReference, NotebookRequest, PageRequest, TextBoxPayload, TextReferencePayload } from '@/types'
import * as notebooksApi from '@/services/notebooksApi'
import * as pagesApi from '@/services/pagesApi'
import { sanitizeBoxHtml } from '@/utils/sanitizeHtml'

/** Separate key for lightweight UI preferences (progress toggle, etc.). */
const UI_STORAGE_KEY = 'onenote-ui:v1'

/** Load the persisted "show progress" preference. */
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

/** Load the persisted "show feedback" preference (defaults to on). */
function loadShowFeedback(): boolean {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { showFeedback?: boolean }
      return parsed.showFeedback !== false
    }
  } catch {
    /* ignore malformed storage */
  }
  return true
}

interface State {
  // Data
  notebooks: Notebook[]
  pages: Page[]

  // Server sync state
  loading: boolean
  loaded: boolean
  saving: boolean
  error: string | null

  // UI preferences
  showProgress: boolean
  showFeedback: boolean
}

export const useNotesStore = defineStore('notes', {
  state: (): State => {
    return {
      notebooks: [],
      pages: [],
      loading: false,
      loaded: false,
      saving: false,
      error: null,
      showProgress: loadShowProgress(),
      showFeedback: loadShowFeedback()
    }
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
    // --- Server sync -------------------------------------------------------
    /**
     * Load all notebooks and pages from the backend.
     * Called on app mount after auth is confirmed.
     */
    async loadFromServer() {
      this.loading = true
      this.error = null
      try {
        const [notebooks, pages] = await Promise.all([
          notebooksApi.listNotebooks(),
          pagesApi.listAllPages()
        ])
        this.notebooks = notebooks
        this.pages = pages
        this.loaded = true
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load notebooks and pages'
        this.loaded = false
      } finally {
        this.loading = false
      }
    },

    /**
     * Save a single page to the server.
     * Builds the full page payload (title, content, boxes with references) and PUTs it.
     */
    async savePage(pageId: string) {
      const page = this.pages.find((p) => p.id === pageId)
      if (!page) return

      this.saving = true
      this.error = null
      try {
        const payload: PageRequest = {
          parentId: page.parentId,
          title: page.title,
          content: page.content,
          order: page.order,
          boxes: page.boxes?.map((box) => ({
            id: box.id,
            x: box.x,
            y: box.y,
            width: box.width,
            text: box.text,
            references: box.references?.map((ref) => ({
              id: ref.id,
              start: ref.start,
              end: ref.end,
              targetPageId: ref.targetPageId
            })) as TextReferencePayload[]
          })) as TextBoxPayload[]
        }
        const updated = await pagesApi.updatePage(pageId, payload)
        // Reconcile: replace local page with server response
        const idx = this.pages.findIndex((p) => p.id === pageId)
        if (idx >= 0) {
          this.pages[idx] = updated
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save page'
      } finally {
        this.saving = false
      }
    },

    /**
     * Save a single notebook (title/color) to the server.
     */
    async saveNotebook(notebookId: string) {
      const notebook = this.notebooks.find((n) => n.id === notebookId)
      if (!notebook) return

      this.saving = true
      this.error = null
      try {
        const payload: NotebookRequest = {
          title: notebook.title,
          color: notebook.color
        }
        const updated = await notebooksApi.updateNotebook(notebookId, payload)
        // Reconcile: replace local notebook with server response
        const idx = this.notebooks.findIndex((n) => n.id === notebookId)
        if (idx >= 0) {
          this.notebooks[idx] = updated
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to save notebook'
      } finally {
        this.saving = false
      }
    },

    // --- UI preferences -------------------------------------------------------
    /** Persist all lightweight UI preferences together (best-effort). */
    persistUiPrefs() {
      try {
        localStorage.setItem(
          UI_STORAGE_KEY,
          JSON.stringify({
            showProgress: this.showProgress,
            showFeedback: this.showFeedback
          })
        )
      } catch {
        /* storage might be unavailable — non-fatal */
      }
    },

    /** Toggle (or explicitly set) the global progress display. */
    setShowProgress(value?: boolean) {
      this.showProgress = value ?? !this.showProgress
      this.persistUiPrefs()
    },

    /** Toggle (or explicitly set) the in-editor feedback callout. */
    setShowFeedback(value?: boolean) {
      this.showFeedback = value ?? !this.showFeedback
      this.persistUiPrefs()
    },

    // --- Notebook CRUD -------------------------------------------------------
    /**
     * Create a new notebook on the server.
     * Returns the created notebook with server-assigned id.
     */
    async addNotebook(title = 'New Notebook', color = '#7719aa'): Promise<Notebook> {
      this.saving = true
      this.error = null
      try {
        const notebook = await notebooksApi.createNotebook({ title, color })
        this.notebooks.push(notebook)
        return notebook
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to create notebook'
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Rename a notebook locally (local mutation only).
     * Must be followed by saveNotebook() to persist to the server.
     */
    renameNotebook(id: string, title: string) {
      const nb = this.notebooks.find((n) => n.id === id)
      if (nb) {
        nb.title = title
      }
    },

    /**
     * Delete a notebook and all its pages on the server.
     */
    async deleteNotebook(id: string): Promise<void> {
      this.saving = true
      this.error = null
      try {
        await notebooksApi.deleteNotebook(id)
        this.notebooks = this.notebooks.filter((n) => n.id !== id)
        this.pages = this.pages.filter((p) => p.notebookId !== id)
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to delete notebook'
        throw err
      } finally {
        this.saving = false
      }
    },

    // --- Page CRUD -----------------------------------------------------------
    /**
     * Create a new page on the server.
     * Returns the created page with server-assigned id.
     */
    async addPage(notebookId: string, parentId: string | null = null, title = 'Untitled Page'): Promise<Page> {
      this.saving = true
      this.error = null
      try {
        const page = await pagesApi.createPage(notebookId, {
          parentId,
          title,
          content: '',
          boxes: []
        })
        this.pages.push(page)
        return page
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to create page'
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Update page title/content locally (local mutation only).
     * Must be followed by savePage() to persist to the server.
     */
    updatePage(id: string, patch: Partial<Pick<Page, 'title' | 'content'>>) {
      const page = this.pages.find((p) => p.id === id)
      if (page) {
        Object.assign(page, patch)
      }
    },

    /**
     * Delete a page (and all descendants) on the server.
     */
    async deletePage(id: string): Promise<void> {
      this.saving = true
      this.error = null
      try {
        await pagesApi.deletePage(id)
        // Remove the deleted page and all descendants locally
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
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to delete page'
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Re-parent a page locally (local mutation only).
     * Must be followed by savePage() to persist to the server.
     * Guards against cycles.
     */
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
      }
    },

    // --- Text box CRUD -------------------------------------------------------
    /**
     * Add a new text box to a page (local mutation only).
     * Must be followed by savePage() to persist to the server.
     */
    addTextBox(pageId: string, box: Omit<TextBox, 'id'>): TextBox | undefined {
      const page = this.pages.find((p) => p.id === pageId)
      if (!page) return
      if (!page.boxes) page.boxes = []
      const tb: TextBox = {
        id: crypto.randomUUID(),
        references: [],
        ...box,
        text: sanitizeBoxHtml(box.text ?? '')
      }
      page.boxes.push(tb)
      return tb
    },

    /**
     * Update a text box (local mutation only).
     * Must be followed by savePage() to persist to the server.
     */
    updateTextBox(
      pageId: string,
      boxId: string,
      patch: Partial<Pick<TextBox, 'text' | 'x' | 'y' | 'width'>>
    ) {
      const page = this.pages.find((p) => p.id === pageId)
      const box = page?.boxes?.find((b) => b.id === boxId)
      if (box) {
        // Sanitize incoming rich-text before it is stored.
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
      }
    },

    /**
     * Add an inline page reference to a box (local mutation only).
     * Optionally replaces the marked range with `linkText` first.
     * Must be followed by savePage() to persist to the server.
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
        id: crypto.randomUUID(),
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
      return reference
    },

    /**
     * Remove an inline reference from a box (local mutation only).
     * Must be followed by savePage() to persist to the server.
     */
    removeBoxReference(pageId: string, boxId: string, referenceId: string) {
      const page = this.pages.find((p) => p.id === pageId)
      const box = page?.boxes?.find((b) => b.id === boxId)
      if (box?.references) {
        box.references = box.references.filter((r) => r.id !== referenceId)
      }
    },

    /**
     * Update an inline reference (local mutation only).
     * Optionally rewrite its linked text and/or target page.
     * Must be followed by savePage() to persist to the server.
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
    },

    /**
     * Remove a text box (local mutation only).
     * Must be followed by savePage() to persist to the server.
     */
    removeTextBox(pageId: string, boxId: string) {
      const page = this.pages.find((p) => p.id === pageId)
      if (page?.boxes) {
        page.boxes = page.boxes.filter((b) => b.id !== boxId)
      }
    }
  }
})

