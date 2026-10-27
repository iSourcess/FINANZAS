import { describe, it, expect } from 'vitest'
import {
  getNextCutDate,
  getNextPayDate,
  getCreditCardStatus,
} from '../src/domain/creditCards.js'

describe('Domain: credit cards and billing cycles', () => {
  describe('getNextCutDate and getNextPayDate', () => {
    it('calculates next cut date when before cut day in same month', () => {
      // Hoy: 12 de octubre 2026, Día de corte: 17
      const refDate = new Date(2026, 9, 12)
      const nextCut = getNextCutDate(17, refDate)

      expect(nextCut).toBe('2026-10-17')
    })

    it('calculates next cut date when after cut day (moves to next month)', () => {
      // Hoy: 18 de octubre 2026, Día de corte: 17
      const refDate = new Date(2026, 9, 18)
      const nextCut = getNextCutDate(17, refDate)

      expect(nextCut).toBe('2026-11-17')
    })

    it('calculates payment date in next month when payDay < cutDay', () => {
      // Corte: 17, Pago: 7 (en México, pago suele ser el mes siguiente al corte)
      // Si corte es 17 oct 2026, pago es 7 nov 2026
      const refDate = new Date(2026, 9, 12)
      const nextPay = getNextPayDate(7, 17, refDate)

      expect(nextPay).toBe('2026-11-07')
    })

    it('calculates payment date in same month when payDay > cutDay', () => {
      // Corte: 5, Pago: 25
      const refDate = new Date(2026, 9, 2)
      const nextPay = getNextPayDate(25, 5, refDate)

      expect(nextPay).toBe('2026-10-25')
    })
  })

  describe('getCreditCardStatus: available credit (limit - debt - pending MSI)', () => {
    it('calculates available credit factoring in current debt and pending MSI', () => {
      const account = {
        id: 'nu-credit',
        type: 'credit',
        balance: 200_000, // $2,000 deuda corriente
        credit: {
          limit: 1_500_000, // $15,000 límite
          cutDay: 17,
          payDay: 7,
        },
      }

      const movements = [
        // Gasto a 6 meses de $6,000 realizado este mes (restan 5 meses de $1,000 = $5,000 = 500,000 centavos)
        {
          id: 'mov-msi-1',
          accountId: 'nu-credit',
          type: 'expense',
          amount: 600_000,
          date: '2026-10-05',
          note: 'Laptop',
          msi: {
            months: 6,
            startDate: '2026-10-05',
            monthlyAmount: 100_000,
          },
        },
      ]

      const refDate = new Date(2026, 9, 12)
      const status = getCreditCardStatus({
        account,
        movements,
        referenceDate: refDate,
      })

      expect(status.limitCents).toBe(1_500_000)
      expect(status.currentDebtCents).toBe(200_000)
      expect(status.pendingMsiDebtCents).toBe(500_000) // $5,000 restante
      expect(status.totalDebtCents).toBe(700_000)      // $2,000 + $5,000 = $7,000

      // Disponible = 15,000 - 7,000 = $8,000 (800,000 centavos)
      expect(status.availableCreditCents).toBe(800_000)
      expect(status.nextCutDate).toBe('2026-10-17')
      expect(status.nextPayDate).toBe('2026-11-07')

      expect(status.activeMsiList.length).toBe(1)
      expect(status.activeMsiList[0].paidMonths).toBe(1)
      expect(status.activeMsiList[0].totalMonths).toBe(6)
    })

    it('calculates daysToCut and daysToPay identically at 00:01 and 23:59 of the same day', () => {
      const account = {
        id: 'nu-credit',
        type: 'credit',
        balance: 100_000,
        credit: {
          limit: 1_000_000,
          cutDay: 17,
          payDay: 7,
        },
      }

      // Referencia a las 00:01 del 12 de octubre 2026
      const morningRef = new Date(2026, 9, 12, 0, 1, 0)
      const morningStatus = getCreditCardStatus({
        account,
        movements: [],
        referenceDate: morningRef,
      })

      // Referencia a las 23:59 del 12 de octubre 2026
      const nightRef = new Date(2026, 9, 12, 23, 59, 0)
      const nightStatus = getCreditCardStatus({
        account,
        movements: [],
        referenceDate: nightRef,
      })

      // Del 12 al 17 de octubre son exactamente 5 días de calendario
      expect(morningStatus.daysToCut).toBe(5)
      expect(nightStatus.daysToCut).toBe(5)

      // Del 12 de octubre al 7 de noviembre son exactamente 26 días de calendario
      expect(morningStatus.daysToPay).toBe(26)
      expect(nightStatus.daysToPay).toBe(26)
    })
  })
})
