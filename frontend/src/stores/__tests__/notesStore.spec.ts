import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotesStore } from '@/stores/notesStore'

const STORAGE_KEY = 'onenote-notes:v2'

describe('notesStore — happy paths', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('adds a notebook', () => {
    const store = useNotesStore()
    const before = store.notebooks.length
    const nb = store.addNotebook('Work', '#123456')

    expect(store.notebooks).toHaveLength(before + 1)
    expect(store.notebookById(nb.id)).toEqual(
      expect.objectContaining({ title: 'Work', color: '#123456' })
    )
  })

  it('renames a notebook', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('Old Name')

    store.renameNotebook(nb.id, 'New Name')

    expect(store.notebookById(nb.id)!.title).toBe('New Name')
  })

  it('ignores rename for an unknown notebook id', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('Keep')

    store.renameNotebook('does-not-exist', 'Nope')

    expect(store.notebookById(nb.id)!.title).toBe('Keep')
  })

  it('deletes a notebook and cascades its pages', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('Doomed')
    const root = store.addPage(nb.id, null, 'Root')
    store.addPage(nb.id, root.id, 'Child')
    const other = store.addNotebook('Survivor')
    const keptPage = store.addPage(other.id, null, 'Kept')

    store.deleteNotebook(nb.id)

    expect(store.notebookById(nb.id)).toBeUndefined()
    expect(store.pagesByNotebook(nb.id)).toHaveLength(0)
    // Unrelated notebook and its pages are untouched.
    expect(store.notebookById(other.id)).toBeDefined()
    expect(store.pageById(keptPage.id)).toBeDefined()
  })

  it('adds a page initialized with an empty boxes array', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('NB')
    const page = store.addPage(nb.id, null, 'Page A')

    expect(page.notebookId).toBe(nb.id)
    expect(page.parentId).toBeNull()
    expect(page.title).toBe('Page A')
    expect(page.boxes).toEqual([])
  })

  it('adds a text box to a page', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('NB')
    const page = store.addPage(nb.id)

    const box = store.addTextBox(page.id, { x: 30, y: 60, text: 'Note' })

    expect(box).toBeDefined()
    expect(box!.id).toMatch(/^tb-/)
    expect(store.pageById(page.id)!.boxes).toEqual([
      expect.objectContaining({ x: 30, y: 60, text: 'Note' })
    ])
  })

  it('updates a text box', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('NB')
    const page = store.addPage(nb.id)
    const box = store.addTextBox(page.id, { x: 0, y: 0, text: 'Old' })!

    store.updateTextBox(page.id, box.id, { text: 'New', x: 99, y: 88 })

    const updated = store.pageById(page.id)!.boxes[0]
    expect(updated).toEqual(
      expect.objectContaining({ text: 'New', x: 99, y: 88 })
    )
  })

  it('removes a text box', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('NB')
    const page = store.addPage(nb.id)
    const box = store.addTextBox(page.id, { x: 0, y: 0, text: 'Bye' })!

    store.removeTextBox(page.id, box.id)

    expect(store.pageById(page.id)!.boxes).toHaveLength(0)
  })

  it('backfills boxes: [] for legacy persisted pages without it', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        notebooks: [{ id: 'nb-1', title: 'Legacy', color: '#000000' }],
        pages: [
          {
            id: 'pg-1',
            notebookId: 'nb-1',
            parentId: null,
            title: 'Legacy page',
            content: 'old content',
            order: 0
            // note: no `boxes` field (legacy data)
          }
        ]
      })
    )
    setActivePinia(createPinia())
    const store = useNotesStore()

    expect(store.pageById('pg-1')!.boxes).toEqual([])
  })

  it('persists notebooks and pages to localStorage', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('Persisted')
    store.addPage(nb.id, null, 'Persisted page')

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.notebooks.some((n: { id: string }) => n.id === nb.id)).toBe(true)
    expect(parsed.pages.some((p: { title: string }) => p.title === 'Persisted page')).toBe(true)
  })

  it('builds a nested page tree from the flat parentId list', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('NB')
    const root = store.addPage(nb.id, null, 'Root')
    const child = store.addPage(nb.id, root.id, 'Child')

    const tree = store.pageTree(nb.id)
    const rootNode = tree.find((n) => n.id === root.id)
    expect(rootNode).toBeDefined()
    expect(rootNode!.children.map((c) => c.id)).toContain(child.id)
  })
})

describe('notesStore — inline references (links)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  /** Set up a notebook + page + one text box, returning their ids. */
  function setup(text = 'See Napoleon here') {
    const store = useNotesStore()
    const nb = store.addNotebook('History')
    const page = store.addPage(nb.id, null, 'French Revolution')
    const target = store.addPage(nb.id, null, 'Napoleon')
    const box = store.addTextBox(page.id, { x: 0, y: 0, text })!
    return { store, nb, page, target, box }
  }

  it('defaults references to [] for new text boxes', () => {
    const { box } = setup()
    expect(box.references).toEqual([])
  })

  it('adds a reference over an existing range (no text change)', () => {
    const { store, page, target, box } = setup('See Napoleon here')

    const ref = store.addBoxReference(page.id, box.id, {
      start: 4,
      end: 12,
      targetPageId: target.id
    })

    expect(ref).toBeDefined()
    expect(ref!.id).toMatch(/^ref-/)
    const saved = store.pageById(page.id)!.boxes[0]
    expect(saved.text).toBe('See Napoleon here')
    expect(saved.references).toEqual([
      expect.objectContaining({ start: 4, end: 12, targetPageId: target.id })
    ])
  })

  it('rewrites the marked range when linkText differs and records offsets', () => {
    const { store, page, target, box } = setup('See Nap here')

    store.addBoxReference(page.id, box.id, {
      start: 4,
      end: 7, // "Nap"
      targetPageId: target.id,
      linkText: 'Napoleon'
    })

    const saved = store.pageById(page.id)!.boxes[0]
    expect(saved.text).toBe('See Napoleon here')
    expect(saved.references[0]).toEqual(
      expect.objectContaining({ start: 4, end: 12, targetPageId: target.id })
    )
  })

  it('removes a reference but keeps the text', () => {
    const { store, page, target, box } = setup('See Napoleon here')
    const ref = store.addBoxReference(page.id, box.id, {
      start: 4,
      end: 12,
      targetPageId: target.id
    })!

    store.removeBoxReference(page.id, box.id, ref.id)

    const saved = store.pageById(page.id)!.boxes[0]
    expect(saved.references).toHaveLength(0)
    expect(saved.text).toBe('See Napoleon here')
  })

  it('updates a reference target', () => {
    const { store, nb, page, target, box } = setup('See Napoleon here')
    const other = store.addPage(nb.id, null, 'Other')
    const ref = store.addBoxReference(page.id, box.id, {
      start: 4,
      end: 12,
      targetPageId: target.id
    })!

    store.updateBoxReference(page.id, box.id, ref.id, { targetPageId: other.id })

    expect(store.pageById(page.id)!.boxes[0].references[0].targetPageId).toBe(other.id)
  })

  it('updates a reference text, shifting later references', () => {
    const { store, page, target } = setup('AA BB CC')
    // Re-create the box with two references: "AA" (0-2) and "CC" (6-8).
    const box = store.pageById(page.id)!.boxes[0]
    const r1 = store.addBoxReference(page.id, box.id, {
      start: 0,
      end: 2,
      targetPageId: target.id
    })!
    store.addBoxReference(page.id, box.id, {
      start: 6,
      end: 8,
      targetPageId: target.id
    })

    store.updateBoxReference(page.id, box.id, r1.id, { linkText: 'AAAA' })

    const saved = store.pageById(page.id)!.boxes[0]
    expect(saved.text).toBe('AAAA BB CC')
    const first = saved.references.find((r) => r.id === r1.id)!
    const second = saved.references.find((r) => r.id !== r1.id)!
    expect(first).toEqual(expect.objectContaining({ start: 0, end: 4 }))
    expect(second).toEqual(expect.objectContaining({ start: 8, end: 10 }))
  })

  it('prunes references whose linked substring changes on text edit', () => {
    const { store, page, target, box } = setup('Hello Napoleon')
    store.addBoxReference(page.id, box.id, {
      start: 6,
      end: 14,
      targetPageId: target.id
    })

    // Editing before the link so the offsets no longer cover "Napoleon".
    store.updateTextBox(page.id, box.id, { text: 'Hi Napoleon' })

    expect(store.pageById(page.id)!.boxes[0].references).toHaveLength(0)
  })

  it('keeps references when an unrelated part of the text is edited in place', () => {
    const { store, page, target, box } = setup('Hello Napoleon')
    store.addBoxReference(page.id, box.id, {
      start: 6,
      end: 14,
      targetPageId: target.id
    })

    // Same length, "Napoleon" stays at 6-14.
    store.updateTextBox(page.id, box.id, { text: 'Jello Napoleon' })

    expect(store.pageById(page.id)!.boxes[0].references).toHaveLength(1)
  })

  it('pagePath returns the notebook → ancestors → page breadcrumb', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('History')
    const root = store.addPage(nb.id, null, 'French Revolution')
    const child = store.addPage(nb.id, root.id, 'Napoleon')

    expect(store.pagePath(child.id)).toEqual(['History', 'French Revolution', 'Napoleon'])
  })

  it('allNotebookTrees pairs each notebook with its page tree', () => {
    const store = useNotesStore()
    const nb = store.addNotebook('History')
    const root = store.addPage(nb.id, null, 'Root')
    store.addPage(nb.id, root.id, 'Child')

    const trees = store.allNotebookTrees
    const entry = trees.find((t) => t.notebook.id === nb.id)
    expect(entry).toBeDefined()
    expect(entry!.tree.find((n) => n.id === root.id)!.children).toHaveLength(1)
  })

  it('backfills references: [] for legacy persisted boxes without it', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        notebooks: [{ id: 'nb-1', title: 'Legacy', color: '#000000' }],
        pages: [
          {
            id: 'pg-1',
            notebookId: 'nb-1',
            parentId: null,
            title: 'Legacy page',
            content: '',
            boxes: [{ id: 'tb-1', x: 0, y: 0, text: 'No refs field' }],
            order: 0
          }
        ]
      })
    )
    setActivePinia(createPinia())
    const store = useNotesStore()

    expect(store.pageById('pg-1')!.boxes[0].references).toEqual([])
  })
})


