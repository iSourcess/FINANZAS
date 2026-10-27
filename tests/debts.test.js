import { describe, it, expect } from 'vitest'
import {
  calculateDebtTotalPaid,
  calculateDebtRemainingCents,
  calculateDebtProgressPercent,
  calculateDebtStatus,
  validateDebtPayment,
  isDebtOverdue,
  isDebtUpcoming,
  upcomingDebtDue,
  calculateDebtsSummary,
  getAdjustmentDetailsForDebt,
} from '../src/domain/debts.js'

describe('Domain: debts and loans logic', () => {
  const debtOwedToMe = {
    id: 'debt-1',
    direction: 'owed_to_me',
    person: 'Luis Morales',
    principalCents: 100000, // $1,000.00 MXN
    currency: 'MXN',
    openedAt: '2026-10-01',
    dueDate: '2026-10-25',
    status: 'open',
  }

  const debtIOwe = {
    id: 'debt-2',
    direction: 'i_owe',
    person: 'Laura Gómez',
    principalCents: 50000, // $500.00 USD
    currency: 'USD',
    openedAt: '2026-10-10',
    dueDate: '2026-11-05',
    status: 'open',
  }

  const payments = [
    { id: 'p-1', debtId: 'debt-1', amountCents: 30000, date: '2026-10-12' },
    { id: 'p-2', debtId: 'debt-1', amountCents: 20000, date: '2026-10-18' },
  ]

  describe('Remaining balance and progress', () => {
    it('calculates total paid and remaining balance', () => {
      const paid = calculateDebtTotalPaid(debtOwedToMe, payments)
      expect(paid).toBe(50000)

      const remaining = calculateDebtRemainingCents(debtOwedToMe, payments)
      expect(remaining).toBe(50000)

      const percent = calculateDebtProgressPercent(debtOwedToMe, payments)
      expect(percent).toBe(50)
    })

    it('returns 0 remaining and 100% progress when fully paid', () => {
      const fullPayments = [
        ...payments,
        { id: 'p-3', debtId: 'debt-1', amountCents: 50000, date: '2026-10-20' },
      ]
      expect(calculateDebtRemainingCents(debtOwedToMe, fullPayments)).toBe(0)
      expect(calculateDebtProgressPercent(debtOwedToMe, fullPayments)).toBe(100)
      expect(calculateDebtStatus(debtOwedToMe, fullPayments)).toBe('settled')
    })

    it('returns original principal when no payments have been made', () => {
      expect(calculateDebtRemainingCents(debtIOwe, [])).toBe(50000)
      expect(calculateDebtProgressPercent(debtIOwe, [])).toBe(0)
      expect(calculateDebtStatus(debtIOwe, [])).toBe('open')
    })
  })

  describe('validateDebtPayment', () => {
    it('rejects payments of 0 or negative', () => {
      const res = validateDebtPayment({
        remainingCents: 50000,
        paymentAmountCents: 0,
      })
      expect(res.valid).toBe(false)
      expect(res.error).toContain('mayor a 0')
    })

    it('rejects payments exceeding remaining balance unless allowOverpayment is true', () => {
      const rejected = validateDebtPayment({
        remainingCents: 50000,
        paymentAmountCents: 60000,
        allowOverpayment: false,
      })
      expect(rejected.valid).toBe(false)
      expect(rejected.requiresConfirmation).toBe(true)

      const allowed = validateDebtPayment({
        remainingCents: 50000,
        paymentAmountCents: 60000,
        allowOverpayment: true,
      })
      expect(allowed.valid).toBe(true)
    })

    it('approves exact or partial payment', () => {
      const partial = validateDebtPayment({
        remainingCents: 50000,
        paymentAmountCents: 25000,
      })
      expect(partial.valid).toBe(true)

      const exact = validateDebtPayment({
        remainingCents: 50000,
        paymentAmountCents: 50000,
      })
      expect(exact.valid).toBe(true)
    })
  })

  describe('Overdue and upcoming due dates', () => {
    it('identifies overdue debt when dueDate < today and not settled', () => {
      const today = '2026-10-26'
      // debtOwedToMe dueDate is 2026-10-25 -> overdue
      expect(isDebtOverdue(debtOwedToMe, today, payments)).toBe(true)
      // debtIOwe dueDate is 2026-11-05 -> not overdue
      expect(isDebtOverdue(debtIOwe, today, [])).toBe(false)
    })

    it('identifies upcoming debts within specified window', () => {
      const today = '2026-10-30'
      // debtIOwe dueDate is 2026-11-05 -> 6 days diff, upcoming within 7 days
      expect(isDebtUpcoming(debtIOwe, today, 7, [])).toBe(true)
      expect(isDebtUpcoming(debtIOwe, today, 3, [])).toBe(false)
    })

    it('upcomingDebtDue returns overdue and upcoming debts sorted', () => {
      const today = '2026-10-26'
      const debts = [debtOwedToMe, debtIOwe]
      const dueList = upcomingDebtDue(debts, today, 15, payments)

      expect(dueList).toHaveLength(2)
      expect(dueList[0].id).toBe('debt-1')
      expect(dueList[0].isOverdue).toBe(true)
      expect(dueList[1].id).toBe('debt-2')
      expect(dueList[1].isOverdue).toBe(false)
    })
  })

  describe('calculateDebtsSummary with multi-currency and FX conversion', () => {
    it('calculates totals in MXN and USD and consolidates in MXN', () => {
      // debt-1: $500.00 MXN remaining (owed_to_me)
      // debt-2: $500.00 USD remaining (i_owe)
      // fxRate: 20.00 MXN per USD
      const summary = calculateDebtsSummary({
        debts: [debtOwedToMe, debtIOwe],
        payments,
        fxRate: 20,
      })

      expect(summary.owedToMeMXNCents).toBe(50000) // $500.00 MXN
      expect(summary.owedToMeUSDCents).toBe(0)
      expect(summary.totalOwedToMeMXN).toBe(50000) // $500.00 MXN

      expect(summary.iOweMXNCents).toBe(0)
      expect(summary.iOweUSDCents).toBe(50000) // $500.00 USD
      expect(summary.totalIOweMXN).toBe(1000000) // 500 USD * 20 = $10,000.00 MXN

      // Neto = 50,000 - 1,000,000 = -950,000 centavos (-$9,500.00 MXN)
      expect(summary.netBalanceMXN).toBe(-950000)
      expect(summary.openCount).toBe(2)
      expect(summary.settledCount).toBe(0)
    })
  })

  describe('getAdjustmentDetailsForDebt', () => {
    it('generates loan_given adjustment with negative delta when lending money', () => {
      const adj = getAdjustmentDetailsForDebt({
        debt: debtOwedToMe,
        amountCents: 100000,
        accountId: 'acc-bbva',
        date: '2026-10-01',
        isPayment: false,
      })

      expect(adj.type).toBe('adjustment')
      expect(adj.reason).toBe('loan_given')
      expect(adj.deltaCents).toBe(-100000) // Sale dinero
      expect(adj.debtId).toBe('debt-1')
      expect(adj.accountId).toBe('acc-bbva')
    })

    it('generates loan_received adjustment with positive delta when borrowing money', () => {
      const adj = getAdjustmentDetailsForDebt({
        debt: debtIOwe,
        amountCents: 50000,
        accountId: 'acc-nu',
        date: '2026-10-10',
        isPayment: false,
      })

      expect(adj.type).toBe('adjustment')
      expect(adj.reason).toBe('loan_received')
      expect(adj.deltaCents).toBe(50000) // Entra dinero
      expect(adj.debtId).toBe('debt-2')
    })

    it('generates repayment_received adjustment with positive delta when receiving payment', () => {
      const adj = getAdjustmentDetailsForDebt({
        debt: debtOwedToMe,
        amountCents: 30000,
        accountId: 'acc-bbva',
        date: '2026-10-12',
        isPayment: true,
      })

      expect(adj.type).toBe('adjustment')
      expect(adj.reason).toBe('repayment_received')
      expect(adj.deltaCents).toBe(30000) // Me pagaron: entra dinero
    })

    it('generates repayment_made adjustment with negative delta when paying off my debt', () => {
      const adj = getAdjustmentDetailsForDebt({
        debt: debtIOwe,
        amountCents: 20000,
        accountId: 'acc-nu',
        date: '2026-10-15',
        isPayment: true,
      })

      expect(adj.type).toBe('adjustment')
      expect(adj.reason).toBe('repayment_made')
      expect(adj.deltaCents).toBe(-20000) // Yo pagué: sale dinero
    })
  })
})
