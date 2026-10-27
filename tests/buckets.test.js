import { describe, it, expect } from 'vitest'
import { getBuckets } from '../src/domain/buckets.js'

describe('Domain: buckets generation for charts', () => {
  it('generates 7 daily buckets for a week period', () => {
    const period = {
      type: 'week',
      startDate: '2026-10-12', // Lunes
      endDate: '2026-10-18',   // Domingo
    }

    const buckets = getBuckets(period)

    expect(buckets.length).toBe(7)
    expect(buckets[0]).toEqual({
      start: '2026-10-12',
      end: '2026-10-12',
      label: '12',
    })
    expect(buckets[6]).toEqual({
      start: '2026-10-18',
      end: '2026-10-18',
      label: '18',
    })
  })

  it('generates daily buckets for a month period (e.g. 31 days in October)', () => {
    const period = {
      type: 'month',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    }

    const buckets = getBuckets(period)

    expect(buckets.length).toBe(31)
    expect(buckets[0].start).toBe('2026-10-01')
    expect(buckets[0].label).toBe('01')
    expect(buckets[30].start).toBe('2026-10-31')
    expect(buckets[30].label).toBe('31')
  })

  it('generates 12 monthly buckets for a year period', () => {
    const period = {
      type: 'year',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    }

    const buckets = getBuckets(period)

    expect(buckets.length).toBe(12)
    expect(buckets[0].start).toBe('2026-01-01')
    expect(buckets[0].end).toBe('2026-01-31')
    expect(buckets[0].label).toBe('Ene')

    expect(buckets[11].start).toBe('2026-12-01')
    expect(buckets[11].end).toBe('2026-12-31')
    expect(buckets[11].label).toBe('Dic')
  })

  describe('Custom range rules (<=31 days -> days, <=120 days -> weeks, >120 days -> months)', () => {
    it('uses daily buckets when custom range is <= 31 days', () => {
      // 15 días
      const period = {
        type: 'custom',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      }

      const buckets = getBuckets(period)
      expect(buckets.length).toBe(15)
      expect(buckets[0].start).toBe(buckets[0].end)
    })

    it('uses weekly buckets when custom range is <= 120 days (e.g. 60 days)', () => {
      // 61 días (aprox 2 meses: del 1 de octubre al 30 de noviembre)
      const period = {
        type: 'custom',
        startDate: '2026-10-01',
        endDate: '2026-11-30',
      }

      const buckets = getBuckets(period)
      // En 61 días caben unas 9 semanas
      expect(buckets.length).toBeGreaterThanOrEqual(8)
      expect(buckets.length).toBeLessThanOrEqual(10)
      // Cada cubeta semanal cubre 7 días
      expect(buckets[0].start).toBe('2026-10-01')
      expect(buckets[0].end).toBe('2026-10-07')
    })

    it('uses monthly buckets when custom range is > 120 days (e.g. 180 days)', () => {
      // 6 meses (1 ene a 30 jun)
      const period = {
        type: 'custom',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      }

      const buckets = getBuckets(period)
      expect(buckets.length).toBe(6)
      expect(buckets[0].label).toContain('Ene')
      expect(buckets[5].label).toContain('Jun')
    })
  })
})
