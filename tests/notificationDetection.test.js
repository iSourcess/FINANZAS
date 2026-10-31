import { describe, it, expect } from 'vitest'
import {
  generateStableNotificationId,
  isDuplicateNotification,
  filterAllowedNotifications,
  maskSensitiveData,
  isSampleExpired,
  filterExpiredSamples,
  resolveMappedAccounts,
} from '../src/domain/notificationDetection.js'

describe('Domain: Notification Detection & Privacy', () => {
  describe('generateStableNotificationId', () => {
    it('generates a stable deterministic identifier', () => {
      const notif1 = {
        packageName: 'com.nu.production',
        title: 'Compra autorizada',
        text: 'Compra por $125.00 en Starbucks',
        id: '101',
      }
      const notif2 = {
        packageName: 'com.nu.production',
        title: 'Compra autorizada',
        text: 'Compra por $125.00 en Starbucks',
        id: '101',
      }

      expect(generateStableNotificationId(notif1)).toBe(generateStableNotificationId(notif2))
    })

    it('differentiates distinct content or packages', () => {
      const notif1 = {
        packageName: 'com.nu.production',
        title: 'Compra autorizada',
        text: 'Compra por $125.00',
      }
      const notif2 = {
        packageName: 'mx.com.bbva.bancomer',
        title: 'Compra autorizada',
        text: 'Compra por $125.00',
      }

      expect(generateStableNotificationId(notif1)).not.toBe(generateStableNotificationId(notif2))
    })
  })

  describe('isDuplicateNotification', () => {
    const baseTime = 1730000000000

    it('detects duplicate by identical id', () => {
      const existing = [{ id: 'notif-1', packageName: 'com.nu.production', postTime: baseTime }]
      const incoming = { id: 'notif-1', packageName: 'com.nu.production', postTime: baseTime + 1000 }

      expect(isDuplicateNotification(existing, incoming)).toBe(true)
    })

    it('detects duplicate by identical content within 5 minutes window', () => {
      const existing = [
        {
          id: 'diff-id-1',
          packageName: 'com.nu.production',
          title: 'Retiro exitoso',
          text: 'Retiraste $500.00 en cajero',
          postTime: baseTime,
        },
      ]
      const incoming = {
        id: 'diff-id-2',
        packageName: 'com.nu.production',
        title: 'Retiro exitoso',
        text: 'Retiraste $500.00 en cajero',
        postTime: baseTime + 60000, // 1 minuto después
      }

      expect(isDuplicateNotification(existing, incoming, 300000)).toBe(true)
    })

    it('does not flag as duplicate if outside the time window', () => {
      const existing = [
        {
          id: 'diff-id-1',
          packageName: 'com.nu.production',
          title: 'Retiro exitoso',
          text: 'Retiraste $500.00 en cajero',
          postTime: baseTime,
        },
      ]
      const incoming = {
        id: 'diff-id-2',
        packageName: 'com.nu.production',
        title: 'Retiro exitoso',
        text: 'Retiraste $500.00 en cajero',
        postTime: baseTime + 400000, // más de 5 minutos
      }

      expect(isDuplicateNotification(existing, incoming, 300000)).toBe(false)
    })

    it('does not flag as duplicate if content differs', () => {
      const existing = [
        {
          id: 'id-1',
          packageName: 'com.nu.production',
          title: 'Compra en Uber',
          text: 'Monto: $120.00',
          postTime: baseTime,
        },
      ]
      const incoming = {
        id: 'id-2',
        packageName: 'com.nu.production',
        title: 'Compra en OXXO',
        text: 'Monto: $50.00',
        postTime: baseTime + 10000,
      }

      expect(isDuplicateNotification(existing, incoming)).toBe(false)
    })
  })

  describe('filterAllowedNotifications (Privacy allowlist)', () => {
    it('strictly keeps only notifications from allowed packages', () => {
      const notifications = [
        { packageName: 'com.nu.production', title: 'Compra Nu' },
        { packageName: 'com.whatsapp', title: 'Mensaje de Mamá' },
        { packageName: 'com.instagram.android', title: 'Nuevo seguidor' },
        { packageName: 'mx.com.bbva.bancomer', title: 'Transferencia recibida' },
      ]
      const allowlist = ['com.nu.production', 'mx.com.bbva.bancomer']

      const filtered = filterAllowedNotifications(notifications, allowlist)

      expect(filtered).toHaveLength(2)
      expect(filtered.map(f => f.packageName)).toEqual([
        'com.nu.production',
        'mx.com.bbva.bancomer',
      ])
    })

    it('returns empty array if allowlist is empty', () => {
      const notifications = [{ packageName: 'com.nu.production', title: 'Compra Nu' }]
      expect(filterAllowedNotifications(notifications, [])).toHaveLength(0)
    })
  })

  describe('maskSensitiveData (Sensitive numbers masking while preserving amounts)', () => {
    it('preserves amounts with currency symbols and masks card/folio numbers', () => {
      const text = 'Compra de $1,250.00 aprobada con tarjeta terminada en 4567. Folio: 98124501.'
      const masked = maskSensitiveData(text)

      expect(masked).toContain('$1,250.00')
      expect(masked).not.toContain('4567')
      expect(masked).not.toContain('98124501')
      expect(masked).toContain('••••')
    })

    it('preserves amounts with suffixes like MXN or pesos and masks CLABE/phone', () => {
      const text = 'Transferencia por 350.50 MXN a CLABE 012180015678901234 desde tel 5512345678.'
      const masked = maskSensitiveData(text)

      expect(masked).toContain('350.50 MXN')
      expect(masked).not.toContain('012180015678901234')
      expect(masked).not.toContain('5512345678')
    })

    it('preserves round amounts like $4500 and masks full 16-digit card numbers', () => {
      const text = 'Cargo de $4500 a la tarjeta 4152 3134 1234 5678 en Liverpool.'
      const masked = maskSensitiveData(text)

      expect(masked).toContain('$4500')
      expect(masked).not.toContain('4152')
      expect(masked).not.toContain('5678')
    })

    it('leaves small non-sensitive numbers intact (1-3 digits)', () => {
      const text = 'Pago en 3 mensualidades sin intereses de $200.00 el día 15.'
      const masked = maskSensitiveData(text)

      expect(masked).toContain('3')
      expect(masked).toContain('15')
      expect(masked).toContain('$200.00')
    })
  })

  describe('7-day sample expiration & cleanup', () => {
    const now = 1730000000000 // referencia fija
    const oneDayMs = 24 * 60 * 60 * 1000

    it('identifies samples older than 7 days as expired', () => {
      const freshSample = { postTime: now - 3 * oneDayMs } // 3 días de antigüedad
      const borderlineSample = { postTime: now - 6.9 * oneDayMs } // 6.9 días
      const expiredSample = { postTime: now - 8 * oneDayMs } // 8 días

      expect(isSampleExpired(freshSample, 7, now)).toBe(false)
      expect(isSampleExpired(borderlineSample, 7, now)).toBe(false)
      expect(isSampleExpired(expiredSample, 7, now)).toBe(true)
    })

    it('filters out expired samples from a list', () => {
      const samples = [
        { id: '1', postTime: now - 2 * oneDayMs },
        { id: '2', postTime: now - 9 * oneDayMs },
        { id: '3', postTime: now - 5 * oneDayMs },
        { id: '4', postTime: now - 14 * oneDayMs },
      ]

      const valid = filterExpiredSamples(samples, 7, now)
      expect(valid.map(s => s.id)).toEqual(['1', '3'])
    })
  })

  describe('resolveMappedAccounts', () => {
    const accounts = [
      { id: 'acc-nu-deb', name: 'Nu Débito' },
      { id: 'acc-nu-cred', name: 'Nu Crédito' },
      { id: 'acc-bbva', name: 'BBVA Débito' },
    ]

    it('resolves multiple accounts assigned to a single bank package', () => {
      const mappings = {
        'com.nu.production': ['acc-nu-deb', 'acc-nu-cred'],
      }

      const result = resolveMappedAccounts('com.nu.production', mappings, accounts)
      expect(result).toHaveLength(2)
      expect(result.map(a => a.name)).toEqual(['Nu Débito', 'Nu Crédito'])
    })

    it('returns empty array if package is not mapped', () => {
      const mappings = {
        'com.nu.production': ['acc-nu-deb'],
      }

      const result = resolveMappedAccounts('com.other.app', mappings, accounts)
      expect(result).toHaveLength(0)
    })
  })
})

