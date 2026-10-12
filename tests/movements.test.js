import { describe, it, expect } from 'vitest'
import {
  calculateBalanceChange,
  applyMovementToAccount,
  revertMovementFromAccount,
} from '../src/domain/movements.js'

describe('Domain: movements balance calculations', () => {
  describe('calculateBalanceChange for Debit/Cash accounts', () => {
    it('increases balance on income', () => {
      const delta = calculateBalanceChange({
        accountType: 'debit',
        movementType: 'income',
        amount: 50000, // $500.00
      })
      expect(delta).toBe(50000)
    })

    it('decreases balance on expense', () => {
      const delta = calculateBalanceChange({
        accountType: 'debit',
        movementType: 'expense',
        amount: 25000, // $250.00
      })
      expect(delta).toBe(-25000)
    })

    it('decreases balance on transfer source', () => {
      const delta = calculateBalanceChange({
        accountType: 'debit',
        movementType: 'transfer',
        amount: 10000,
        isSourceAccount: true,
      })
      expect(delta).toBe(-10000)
    })

    it('increases balance on transfer destination', () => {
      const delta = calculateBalanceChange({
        accountType: 'cash',
        movementType: 'transfer',
        amount: 10000,
        isSourceAccount: false,
      })
      expect(delta).toBe(10000)
    })
  })

  describe('calculateBalanceChange for Credit accounts (balance = debt)', () => {
    it('increases debt on credit card expense', () => {
      const delta = calculateBalanceChange({
        accountType: 'credit',
        movementType: 'expense',
        amount: 120000, // $1,200.00
      })
      expect(delta).toBe(120000)
    })

    it('decreases debt on credit card income/abono', () => {
      const delta = calculateBalanceChange({
        accountType: 'credit',
        movementType: 'income',
        amount: 50000,
      })
      expect(delta).toBe(-50000)
    })

    it('decreases debt when transfer destination is credit card (paying card from debit)', () => {
      const delta = calculateBalanceChange({
        accountType: 'credit',
        movementType: 'transfer',
        amount: 100000,
        isSourceAccount: false,
      })
      expect(delta).toBe(-100000)
    })

    it('increases debt when transfer source is credit card (cash advance)', () => {
      const delta = calculateBalanceChange({
        accountType: 'credit',
        movementType: 'transfer',
        amount: 50000,
        isSourceAccount: true,
      })
      expect(delta).toBe(50000)
    })
  })

  describe('applyMovementToAccount and revertMovementFromAccount', () => {
    it('applies and reverts expense correctly on debit account', () => {
      const account = { id: 'acc-1', type: 'debit', balance: 100000 }
      const movement = { type: 'expense', amount: 30000 }

      const updated = applyMovementToAccount(account, movement)
      expect(updated.balance).toBe(70000)

      const reverted = revertMovementFromAccount(updated, movement)
      expect(reverted.balance).toBe(100000)
    })

    it('applies and reverts credit expense correctly on credit account', () => {
      const account = { id: 'acc-nu', type: 'credit', balance: 50000 } // initial debt $500
      const movement = { type: 'expense', amount: 20000 } // spend $200

      const updated = applyMovementToAccount(account, movement)
      expect(updated.balance).toBe(70000) // debt increases to $700

      const reverted = revertMovementFromAccount(updated, movement)
      expect(reverted.balance).toBe(50000)
    })
  })
})
