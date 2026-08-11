import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotesStore } from '@/stores/notesStore'

const STORAGE_KEY = 'onenote-notes:v1'

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

