/**
 * Progress model for notebooks and pages.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BACKEND SEAM
 * ─────────────────────────────────────────────────────────────────────────
 * Progress values are now provided by the Spring Boot backend, which asks an
 * LLM (or a deterministic offline heuristic) to grade how well each notebook /
 * page topic appears to be understood — following the Feynman technique.
 *
 * The backend result is cached in-module via `setProgress` / `setProgresses`
 * (populated by `useProgressStore`), so the widely-used `getProgress(id)`
 * accessor stays synchronous for templates.
 *
 * Color thresholds are centralized here so they can be made user-customizable
 * later without touching the components.
 */

export interface ProgressThresholds {
  /** Below this percent → "danger" (red). */
  danger: number
  /** Below this percent → "warn" (yellow); at/above → "good" (green). */
  warn: number
}

/** Default thresholds: red < 33, yellow < 75, green ≥ 75. */
export const DEFAULT_THRESHOLDS: ProgressThresholds = {
  danger: 33,
  warn: 75
}

export type ProgressLevel = 'danger' | 'warn' | 'good'

/**
 * Map a percent value to a color level using the given thresholds.
 */
export function progressLevel(
  value: number,
  thresholds: ProgressThresholds = DEFAULT_THRESHOLDS
): ProgressLevel {
  if (value < thresholds.danger) return 'danger'
  if (value < thresholds.warn) return 'warn'
  return 'good'
}

/**
 * In-memory cache of backend-evaluated scores, keyed by notebook / page id.
 * Populated by `useProgressStore.evaluate()` after calling the backend.
 */
const scoreCache: Record<string, number> = {}

/**
 * In-memory cache of the LLM's short "understanding notes" per id, shown as a
 * tooltip on the progress badge so users can see WHY a topic scored as it did.
 */
const notesCache: Record<string, string> = {}

/**
 * Fallback percent for ids the backend has not evaluated yet (e.g. a newly
 * created notebook/page, or before the first evaluation completes).
 */
export const DEFAULT_PROGRESS = 0

/** Clamp a raw value into the valid 0–100 progress range. */
function clamp(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_PROGRESS
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Store a single backend-evaluated score. */
export function setProgress(id: string, value: number): void {
  scoreCache[id] = clamp(value)
}

/** Bulk-store backend-evaluated scores (id → percent). */
export function setProgresses(scores: Record<string, number>): void {
  for (const [id, value] of Object.entries(scores)) {
    scoreCache[id] = clamp(value)
  }
}

/**
 * Merge backend evaluation results into the progress cache.
 *
 * Accepts the `{ score, understandingNotes }` shape returned by the backend
 * (see `evaluationApi.ts`), so callers can pass `pageScores` / `notebookScores`
 * directly.
 */
export function setLiveScores(
  scores: Record<string, { score: number; understandingNotes?: string }>
): void {
  for (const [id, entry] of Object.entries(scores)) {
    if (entry && typeof entry.score === 'number') {
      scoreCache[id] = clamp(entry.score)
      if (entry.understandingNotes) {
        notesCache[id] = entry.understandingNotes
      }
    }
  }
}

/** Clear all cached scores (e.g. on reset-to-seed). */
export function clearProgress(): void {
  for (const key of Object.keys(scoreCache)) delete scoreCache[key]
  for (const key of Object.keys(notesCache)) delete notesCache[key]
}

/**
 * Return the progress percent (0–100) for a notebook or page id.
 *
 * Reads from the backend-populated cache; returns `DEFAULT_PROGRESS` for ids
 * that have not been evaluated yet.
 */
export function getProgress(id: string): number {
  return scoreCache[id] ?? DEFAULT_PROGRESS
}

/**
 * Return the LLM's understanding notes for an id, or an empty string if the id
 * has not been evaluated (or the backend returned no notes).
 */
export function getUnderstandingNotes(id: string): string {
  return notesCache[id] ?? ''
}

