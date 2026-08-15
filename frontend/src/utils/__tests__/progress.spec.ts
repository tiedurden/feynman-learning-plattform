import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_THRESHOLDS,
  progressLevel,
  getProgress,
  setProgress,
  setLiveScores,
  clearProgress,
  DEFAULT_PROGRESS
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

