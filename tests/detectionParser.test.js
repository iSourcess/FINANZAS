import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  parseNotification,
  parseAmountToCents,
  resolveAccountForDetection,
  deduplicatePendingDetection,
  formatNotificationDisplayText,
} from '../src/domain/detectionParser.js'

describe('Domain: Detection Parser & Rules', () => {
  const fixturesPath = path.resolve(__dirname, 'fixtures/notifications.json')
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'))

  describe('Fixtures validation on detection parser', () => {
    fixtures.forEach((fixture) => {
      it(`parses fixture: ${fixture.id} (${fixture.description})`, () => {
        const result = parseNotification(fixture)

        if (fixture.expected.ignored) {
          expect(result.ignored).toBe(true)
        } else {
          expect(result.ignored).toBe(false)
          expect(result.hasAmount).toBe(fixture.expected.hasAmount)

          if (fixture.expected.amountCents !== undefined) {
            expect(result.amountCents).toBe(fixture.expected.amountCents)
          }

          if (fixture.expected.currency) {
            expect(result.currency).toBe(fixture.expected.currency)
          }

          if (fixture.expected.kind !== undefined) {
            expect(result.kind).toBe(fixture.expected.kind)
          }

          if (fixture.expected.merchant !== undefined) {
            expect(result.merchant).toBe(fixture.expected.merchant)
          }

          if (fixture.expected.last4 !== undefined) {
            expect(result.last4).toBe(fixture.expected.last4)
          }
        }
      })
    })
  })

  describe('parseAmountToCents helper', () => {
    it('parses standard currency strings with decimals', () => {
      expect(parseAmountToCents('$125.50')).toBe(12550)
      expect(parseAmountToCents('45.00')).toBe(4500)
      expect(parseAmountToCents('$1,250.00')).toBe(125000)
      expect(parseAmountToCents('$15,800.75')).toBe(1580075)
    })

    it('returns null for strings without numbers', () => {
      expect(parseAmountToCents('Acceso no autorizado')).toBe(null)
      expect(parseAmountToCents('')).toBe(null)
    })
  })

  describe('resolveAccountForDetection', () => {
    const accounts = [
      { id: 'acc_nu_deb', name: 'Nu Débito', last4: '1234' },
      { id: 'acc_nu_cred', name: 'Nu Crédito', credit: { last4: '5678' } },
      { id: 'acc_bbva', name: 'BBVA Nómina', last4: '9999' },
    ]

    const mappings = {
      'com.nu.production': ['acc_nu_deb', 'acc_nu_cred'],
      'mx.com.bbva.bancomer': ['acc_bbva'],
    }

    it('resolves by matching last4 first', () => {
      const detection = { packageName: 'com.nu.production', last4: '5678' }
      const resolved = resolveAccountForDetection(detection, accounts, mappings)
      expect(resolved).toBe('acc_nu_cred')
    })

    it('resolves by default app account if unique', () => {
      const detection = { packageName: 'mx.com.bbva.bancomer', last4: null }
      const resolved = resolveAccountForDetection(detection, accounts, mappings)
      expect(resolved).toBe('acc_bbva')
    })

    it('leaves account null if ambiguous (multiple accounts without matching last4)', () => {
      const detection = { packageName: 'com.nu.production', last4: null }
      const resolved = resolveAccountForDetection(detection, accounts, mappings)
      expect(resolved).toBe(null)
    })
  })

  describe('deduplicatePendingDetection', () => {
    const baseTime = '2026-10-30T12:00:00.000Z'

    it('merges duplicate notifications within 5 minutes into single detection', () => {
      const existing = [
        {
          id: 'det_1',
          packageName: 'com.google.android.apps.walletnfcrel',
          amountCents: 25000,
          currency: 'MXN',
          last4: '1234',
          accountId: 'acc_nu',
          postedAt: baseTime,
          sources: [{ packageName: 'com.google.android.apps.walletnfcrel' }],
        },
      ]

      const incoming = {
        packageName: 'com.nu.production',
        amountCents: 25000,
        currency: 'MXN',
        last4: '1234',
        accountId: 'acc_nu',
        merchant: 'Starbucks',
        postedAt: '2026-10-30T12:02:00.000Z', // 2 minutos después
        sources: [{ packageName: 'com.nu.production' }],
      }

      const result = deduplicatePendingDetection(existing, incoming, 300000)
      expect(result.isDuplicate).toBe(true)
      expect(result.mergedDetection.sources).toHaveLength(2)
      expect(result.mergedDetection.merchant).toBe('Starbucks')
    })

    it('does not merge if outside 5 minutes window', () => {
      const existing = [
        {
          id: 'det_1',
          packageName: 'com.nu.production',
          amountCents: 25000,
          currency: 'MXN',
          last4: '1234',
          postedAt: baseTime,
        },
      ]

      const incoming = {
        packageName: 'com.nu.production',
        amountCents: 25000,
        currency: 'MXN',
        last4: '1234',
        postedAt: '2026-10-30T12:10:00.000Z', // 10 minutos después
      }

      const result = deduplicatePendingDetection(existing, incoming, 300000)
      expect(result.isDuplicate).toBe(false)
    })
  })

  describe('formatNotificationDisplayText (Exact required format)', () => {
    it('formats exact text with amount and bank', () => {
      const text = formatNotificationDisplayText({
        amountCents: 25000,
        currency: 'MXN',
        bankName: 'NU',
        showAmount: true,
      })
      expect(text).toBe('MOVIMIENTO DETECTADO POR $250.00 DE LA CUENTA NU')
    })

    it('formats without amount if amount is hidden (private mode)', () => {
      const text = formatNotificationDisplayText({
        amountCents: 25000,
        currency: 'MXN',
        bankName: 'NU',
        showAmount: false,
      })
      expect(text).toBe('MOVIMIENTO DETECTADO EN LA CUENTA NU')
    })

    it('formats without account if bank is not identified', () => {
      const text = formatNotificationDisplayText({
        amountCents: 15050,
        currency: 'MXN',
        bankName: null,
        showAmount: true,
      })
      expect(text).toBe('MOVIMIENTO DETECTADO POR $150.50')
    })
  })
})

