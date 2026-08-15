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
     * @param notebookId Optional — evaluate only this notebook.
     */
    async evaluate(notebookId?: string) {
      const notes = useNotesStore()
      this.loading = true
      this.error = null
      try {
        // A single-notebook evaluation must not upload unrelated notebooks or
        // pages. Evaluate All intentionally keeps the complete dataset.
        const notebooks = notebookId
          ? notes.notebooks.filter((notebook) => notebook.id === notebookId)
          : notes.notebooks
        const pages = notebookId
          ? notes.pages.filter((page) => page.notebookId === notebookId)
          : notes.pages

        const { pageScores, notebookScores } = await evaluateNotes(
          notebooks,
          pages,
          notebookId
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



