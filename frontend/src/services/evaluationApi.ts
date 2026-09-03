import type { Notebook, Page } from '@/types'
import { apiJson } from './httpClient'

/**
 * Client for the Feynman backend evaluation API.
 *
 * Requests are authenticated (bearer token) via {@link apiJson}.
 */

/** A single understanding score returned by the backend. */
export interface Score {
  score: number
  understandingNotes: string
  /** Longer, actionable Feynman-style feedback paragraph. May be empty. */
  feedback?: string
  /** Short, actionable to-do items the UI can turn into tick boxes. */
  todos?: string[]
}

/** Response shape of {@code POST /api/evaluate}. */
export interface EvaluationResult {
  /** Page id → score. */
  pageScores: Record<string, Score>
  /** Notebook id → aggregate score. */
  notebookScores: Record<string, Score>
}

/**
 * Ask the backend to grade how well the user understands each topic.
 *
 * @param notebooks  All notebooks (or the subset to evaluate).
 * @param pages      All pages (the backend filters by `notebookId` if given).
 * @param notebookId Optional — evaluate only this notebook and its pages.
 */
export async function evaluateNotes(
  notebooks: Notebook[],
  pages: Page[],
  notebookId?: string,
  pageId?: string
): Promise<EvaluationResult> {
  return apiJson<EvaluationResult>('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notebooks, pages, notebookId, pageId })
  })
}



