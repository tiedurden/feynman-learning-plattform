import type { Notebook, Page } from '@/types'
import { evaluateNotes } from '@/services/evaluationApi'
import type { EvaluationResult } from '@/services/evaluationApi'

/**
 * @deprecated Use `@/services/evaluationApi` directly.
 *
 * Kept as a thin re-export so any existing imports of `@/api/evaluation`
 * continue to resolve to the single canonical client.
 */
export type { Score, EvaluationResult } from '@/services/evaluationApi'
export { evaluateNotes } from '@/services/evaluationApi'

/** @deprecated Prefer `evaluateNotes(notebooks, pages, notebookId?)`. */
export async function evaluateNotebooks(payload: {
  notebooks: Notebook[]
  pages: Page[]
  notebookId?: string
}): Promise<EvaluationResult> {
  return evaluateNotes(payload.notebooks, payload.pages, payload.notebookId)
}





