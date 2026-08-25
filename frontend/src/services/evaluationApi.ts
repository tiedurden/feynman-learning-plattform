import type { Notebook, Page } from '@/types'

/**
 * Client for the Feynman backend evaluation API.
 *
 * The base URL is configurable via `VITE_API_BASE_URL`; by default it is empty
 * so requests hit the Vite dev proxy (`/api → http://localhost:8080`).
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

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
  notebookId?: string
): Promise<EvaluationResult> {
  const res = await fetch(`${API_BASE_URL}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notebooks, pages, notebookId })
  })

  if (!res.ok) {
    throw new Error(`Evaluation request failed: ${res.status} ${res.statusText}`)
  }

  return (await res.json()) as EvaluationResult
}


