import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_THRESHOLDS,
  progressLevel,
  getProgress,
  setProgress,
  setLiveScores,
  clearProgress,
  DEFAULT_PROGRESS,
  getFeedback,
  getTodos,
  scoreVersion
} from '@/utils/progress'

describe('progressLevel', () => {
  it('returns "danger" below the danger threshold (< 33)', () => {
    expect(progressLevel(0)).toBe('danger')
    expect(progressLevel(32)).toBe('danger')
  })

  it('returns "warn" between danger and warn thresholds (33–74)', () => {
    expect(progressLevel(33)).toBe('warn')
    expect(progressLevel(74)).toBe('warn')
  })

  it('returns "good" at/above the warn threshold (>= 75)', () => {
    expect(progressLevel(75)).toBe('good')
    expect(progressLevel(100)).toBe('good')
  })

  it('honours custom thresholds', () => {
    expect(progressLevel(50, { danger: 60, warn: 90 })).toBe('danger')
    expect(progressLevel(80, { danger: 60, warn: 90 })).toBe('warn')
    expect(progressLevel(95, { danger: 60, warn: 90 })).toBe('good')
  })

  it('exposes sensible defaults', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ danger: 33, warn: 75 })
  })
})

describe('getProgress', () => {
  beforeEach(() => {
    clearProgress()
  })

  it('returns the default for unknown ids', () => {
    expect(getProgress('nb-unknown')).toBe(DEFAULT_PROGRESS)
  })

  it('is deterministic for the same id', () => {
    expect(getProgress('nb-1')).toBe(getProgress('nb-1'))
  })

  it('always returns a value within 0–100', () => {
    for (const id of ['a', 'nb-1', 'pg-xyz', 'longer-id-string']) {
      const v = getProgress(id)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('reflects a value stored via setProgress (clamped + rounded)', () => {
    setProgress('nb-1', 73.6)
    expect(getProgress('nb-1')).toBe(74)
    setProgress('nb-1', 250)
    expect(getProgress('nb-1')).toBe(100)
    setProgress('nb-1', -10)
    expect(getProgress('nb-1')).toBe(0)
  })

  it('merges backend results via setLiveScores', () => {
    setLiveScores({
      'nb-work': { score: 62, understandingNotes: 'ok' },
      'pg-feynman': { score: 88, understandingNotes: 'clear explanation' }
    })
    expect(getProgress('nb-work')).toBe(62)
    expect(getProgress('pg-feynman')).toBe(88)
  })

  it('clearProgress resets the cache', () => {
    setProgress('nb-1', 50)
    clearProgress()
    expect(getProgress('nb-1')).toBe(DEFAULT_PROGRESS)
  })
})

describe('feedback + to-dos cache', () => {
  beforeEach(() => {
    clearProgress()
  })

  it('returns empty defaults for unknown ids', () => {
    expect(getFeedback('nope')).toBe('')
    expect(getTodos('nope')).toEqual([])
  })

  it('stores feedback and todos via setLiveScores', () => {
    setLiveScores({
      'pg-1': { score: 40, feedback: 'Explain it more simply', todos: ['Add example', 'Explain why'] }
    })
    expect(getFeedback('pg-1')).toBe('Explain it more simply')
    expect(getTodos('pg-1')).toEqual(['Add example', 'Explain why'])
  })

  it('leaves feedback/todos untouched when absent from a later update', () => {
    setLiveScores({ 'pg-1': { score: 40, feedback: 'first', todos: ['a'] } })
    setLiveScores({ 'pg-1': { score: 90 } }) // score-only update
    expect(getFeedback('pg-1')).toBe('first')
    expect(getTodos('pg-1')).toEqual(['a'])
    expect(getProgress('pg-1')).toBe(90)
  })

  it('clearProgress also clears feedback and todos', () => {
    setLiveScores({ 'pg-1': { score: 40, feedback: 'x', todos: ['a'] } })
    clearProgress()
    expect(getFeedback('pg-1')).toBe('')
    expect(getTodos('pg-1')).toEqual([])
  })

  it('bumps scoreVersion when scores change (for reactivity)', () => {
    const before = scoreVersion.value
    setLiveScores({ 'pg-1': { score: 10 } })
    expect(scoreVersion.value).toBeGreaterThan(before)
  })
})

