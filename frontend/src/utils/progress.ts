/**
 * Progress model for notebooks and pages.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BACKEND SEAM
 * ─────────────────────────────────────────────────────────────────────────
 * For now, per-entity progress values are hard-coded constants in the
 * `PROGRESS_CONSTANTS` map below. Later this will be replaced by a backend
 * API call: the BE will evaluate each notebook/page (with help from an LLM
 * model) and return a completion percentage. When that lands, swap the body
 * of `getProgress` for the API-backed lookup and delete the constants map.
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
 * Placeholder progress values keyed by notebook / page id.
 *
 * These are the "random constants" stand-ins until the backend provides real
 * LLM-evaluated progress. Ids match the seed data in `@/data/seed`.
 *
 * TODO(BE): Replace this map + `getProgress` with an API call.
 */
export const PROGRESS_CONSTANTS: Record<string, number> = {
  // --- Notebooks ---
  'nb-work': 62,
  'nb-personal': 28,
  'nb-study': 81,
  // --- Work pages ---
  'pg-projects': 55,
  'pg-project-atlas': 74,
  'pg-atlas-kickoff': 90,
  'pg-atlas-retro': 40,
  'pg-project-nova': 18,
  'pg-meetings': 66,
  // --- Personal pages ---
  'pg-groceries': 100,
  'pg-travel': 45,
  'pg-travel-japan': 30,
  // --- Study pages ---
  'pg-feynman': 77
}

/**
 * Fallback percent for ids not present in the constants map (e.g. newly
 * created notebooks/pages before the BE has evaluated them).
 */
export const DEFAULT_PROGRESS = 0

/**
 * Return the progress percent (0–100) for a notebook or page id.
 *
 * TODO(BE): Replace the constants lookup with the backend/LLM-provided value
 * once the evaluation API exists.
 */
export function getProgress(id: string): number {
  return PROGRESS_CONSTANTS[id] ?? DEFAULT_PROGRESS
}

