import { defineStore } from 'pinia'
import { evaluateNotes } from '@/services/evaluationApi'
import { clearProgress, setLiveScores } from '@/utils/progress'
import { useNotesStore } from './notesStore'

interface State {
  /** True while an evaluation request is in flight. */
  loading: boolean
  /** Last error message, if the most recent evaluation failed. */
  error: string | null
  /** ISO timestamp of the last successful evaluation. */
  lastEvaluatedAt: string | null
}

/**
 * Optional convenience wrapper around backend evaluation. `AppLayout.vue`
 * currently drives evaluation inline, but this store offers the same behaviour
 * for components that prefer a shared, reactive loading/error state.
 */
export const useProgressStore = defineStore('progress', {
  state: (): State => ({
    loading: false,
    error: null,
    lastEvaluatedAt: null
  }),

  actions: {
    /**
     * Send notebooks + pages to the backend and merge the returned page and
     * notebook scores into the progress cache.
     *
     * @param options.notebookId Optional — evaluate only this notebook.
     * @param options.pageId     Optional — evaluate only this single page. Takes
     *   precedence over `notebookId`; no other page (parent or sibling subpage)
     *   is scored, keeping the request cheap for large page trees.
     */
    async evaluate(options: { notebookId?: string; pageId?: string } = {}) {
      const { notebookId, pageId } = options
      const notes = useNotesStore()
      this.loading = true
      this.error = null
      try {
        // Only upload what is being evaluated. A single-page request sends just
        // that page; a notebook request sends that notebook's pages; "Evaluate
        // All" keeps the complete dataset.
        let notebooks = notes.notebooks
        let pages = notes.pages
        if (pageId) {
          const page = notes.pages.find((p) => p.id === pageId)
          pages = page ? [page] : []
          const owningId = notebookId ?? page?.notebookId
          notebooks = owningId
            ? notes.notebooks.filter((notebook) => notebook.id === owningId)
            : notes.notebooks
        } else if (notebookId) {
          notebooks = notes.notebooks.filter((notebook) => notebook.id === notebookId)
          pages = notes.pages.filter((page) => page.notebookId === notebookId)
        }

        const { pageScores, notebookScores } = await evaluateNotes(
          notebooks,
          pages,
          notebookId,
          pageId
        )
        setLiveScores(pageScores)
        setLiveScores(notebookScores)
        this.lastEvaluatedAt = new Date().toISOString()
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
      } finally {
        this.loading = false
      }
    },

    /** Drop all cached scores (e.g. after resetting to seed data). */
    reset() {
      clearProgress()
      this.lastEvaluatedAt = null
      this.error = null
    }
  }
})



