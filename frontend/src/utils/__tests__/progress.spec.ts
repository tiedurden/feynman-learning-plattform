import { describe, it, expect } from 'vitest'
import {
  DEFAULT_THRESHOLDS,
  progressLevel,
  getProgress
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
})

