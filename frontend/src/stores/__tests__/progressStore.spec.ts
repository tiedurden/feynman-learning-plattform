import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Notebook, Page } from '@/types'
import type { EvaluationResult } from '@/services/evaluationApi'

// Mock the backend client so no real request is made and we can inspect the
// exact payload the store uploads for each evaluation mode.
const evaluateNotes = vi.fn<
  (
    notebooks: Notebook[],
    pages: Page[],
    notebookId?: string,
    pageId?: string
  ) => Promise<EvaluationResult>
>()

vi.mock('@/services/evaluationApi', () => ({
  evaluateNotes: (...args: Parameters<typeof evaluateNotes>) => evaluateNotes(...args)
}))

import { useProgressStore } from '@/stores/progressStore'
import { useNotesStore } from '@/stores/notesStore'

describe('progressStore.evaluate — request scoping', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    evaluateNotes.mockReset()
    evaluateNotes.mockResolvedValue({ pageScores: {}, notebookScores: {} })
  })

  it('single-page mode uploads only the target page and forwards its pageId', async () => {
    const notes = useNotesStore()
    const nb = notes.addNotebook('Study')
    const parent = notes.addPage(nb.id, null, 'Parent')
    const child = notes.addPage(nb.id, parent.id, 'Child')
    notes.addPage(nb.id, parent.id, 'Sibling')

    const progress = useProgressStore()
    await progress.evaluate({ notebookId: nb.id, pageId: child.id })

    expect(evaluateNotes).toHaveBeenCalledTimes(1)
    const [notebooks, pages, notebookId, pageId] = evaluateNotes.mock.calls[0]!

    // Only the requested page is sent — not the parent or the sibling subpage.
    expect(pages.map((p) => p.id)).toEqual([child.id])
    expect(notebookId).toBe(nb.id)
    expect(pageId).toBe(child.id)
    // Only the owning notebook is sent.
    expect(notebooks.map((n) => n.id)).toEqual([nb.id])
  })

  it('single-page mode infers the owning notebook when notebookId is omitted', async () => {
    const notes = useNotesStore()
    const nb = notes.addNotebook('Study')
    const page = notes.addPage(nb.id, null, 'Solo')

    const progress = useProgressStore()
    await progress.evaluate({ pageId: page.id })

    const [notebooks, pages, , pageId] = evaluateNotes.mock.calls[0]!
    expect(pages.map((p) => p.id)).toEqual([page.id])
    expect(pageId).toBe(page.id)
    expect(notebooks.map((n) => n.id)).toEqual([nb.id])
  })

  it('notebook mode uploads every page of that notebook and no pageId', async () => {
    const notes = useNotesStore()
    const target = notes.addNotebook('Target')
    const other = notes.addNotebook('Other')
    const p1 = notes.addPage(target.id, null, 'One')
    const p2 = notes.addPage(target.id, p1.id, 'Two')
    notes.addPage(other.id, null, 'Elsewhere')

    const progress = useProgressStore()
    await progress.evaluate({ notebookId: target.id })

    const [notebooks, pages, notebookId, pageId] = evaluateNotes.mock.calls[0]!
    expect(new Set(pages.map((p) => p.id))).toEqual(new Set([p1.id, p2.id]))
    expect(pages.every((p) => p.notebookId === target.id)).toBe(true)
    expect(notebooks.map((n) => n.id)).toEqual([target.id])
    expect(notebookId).toBe(target.id)
    expect(pageId).toBeUndefined()
  })

  it('evaluate-all mode uploads the entire dataset with no filters', async () => {
    const notes = useNotesStore()
    const progress = useProgressStore()
    await progress.evaluate()

    const [notebooks, pages, notebookId, pageId] = evaluateNotes.mock.calls[0]!
    expect(pages).toHaveLength(notes.pages.length)
    expect(notebooks).toHaveLength(notes.notebooks.length)
    expect(notebookId).toBeUndefined()
    expect(pageId).toBeUndefined()
  })

  it('records lastEvaluatedAt on success and surfaces errors on failure', async () => {
    const notes = useNotesStore()
    const nb = notes.addNotebook('Study')
    const page = notes.addPage(nb.id, null, 'Solo')
    const progress = useProgressStore()

    await progress.evaluate({ pageId: page.id })
    expect(progress.error).toBeNull()
    expect(progress.lastEvaluatedAt).not.toBeNull()
    expect(progress.loading).toBe(false)

    evaluateNotes.mockRejectedValueOnce(new Error('boom'))
    await progress.evaluate({ pageId: page.id })
    expect(progress.error).toBe('boom')
    expect(progress.loading).toBe(false)
  })
})

