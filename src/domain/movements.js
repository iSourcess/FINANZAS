/**
 * src/domain/movements.js
 *
 * Lógica pura de movimientos financieros y cálculo de balances.
 *
 * REGLAS ESTRICTAS:
 *   - Funciones puras: sin React, sin IndexedDB, sin efectos secundarios.
 *   - Montos siempre en CENTAVOS ENTEROS.
 *   - Transferencias: mueven saldo sin contar como ingreso ni gasto.
 *   - En cuentas de crédito: balance representa la DEUDA ACUMULADA (positivo = debes).
 *     - Gasto en crédito: aumenta la deuda (+amount).
 *     - Ingreso en crédito (abono): disminuye la deuda (-amount).
 *     - Transferencia hacia crédito (pago de tarjeta): disminuye la deuda (-amount).
 *     - Transferencia desde crédito (disposición): aumenta la deuda (+amount).
 *   - En cuentas de débito / efectivo / ahorro:
 *     - Ingreso: aumenta el saldo (+amount).
 *     - Gasto: disminuye el saldo (-amount).
 *     - Transferencia (origen): disminuye el saldo (-amount).
 *     - Transferencia (destino): aumenta el saldo (+amount).
 */

/**
 * Calcula el cambio que debe aplicarse al balance de una cuenta según el movimiento.
 * @param {Object} params
 * @param {'credit'|'debit'|'cash'|'savings'} params.accountType - Tipo de cuenta
 * @param {'income'|'expense'|'transfer'} params.movementType - Tipo de movimiento
 * @param {number} params.amount - Monto en centavos enteros (> 0)
 * @param {boolean} [params.isSourceAccount=true] - Si es la cuenta origen (para transferencias)
 * @returns {number} Cambio a sumar al balance actual (positivo o negativo)
 */
export function calculateBalanceChange({
  accountType,
  movementType,
  amount,
  isSourceAccount = true,
}) {
  const safeAmount = Math.abs(Math.round(amount || 0))

  if (accountType === 'credit') {
    // Para crédito, balance es DEUDA
    if (movementType === 'expense') {
      // Un gasto incrementa la deuda
      return safeAmount
    }
    if (movementType === 'income') {
      // Un abono/ingreso reduce la deuda
      return -safeAmount
    }
    if (movementType === 'transfer') {
      // Si la tarjeta de crédito es el destino (pagando la tarjeta), reduce la deuda
      if (!isSourceAccount) {
        return -safeAmount
      }
      // Si la tarjeta de crédito es el origen (disposición en efectivo), aumenta la deuda
      return safeAmount
    }
  } else {
    // Para débito, efectivo o ahorro: balance es SALDO POSITIVO
    if (movementType === 'income') {
      return safeAmount
    }
    if (movementType === 'expense') {
      return -safeAmount
    }
    if (movementType === 'transfer') {
      return isSourceAccount ? -safeAmount : safeAmount
    }
  }

  return 0
}

/**
 * Aplica un movimiento a una cuenta y retorna la cuenta con el nuevo balance.
 * @param {Object} account - Objeto de cuenta { id, balance, type, ... }
 * @param {Object} movement - Objeto de movimiento { type, amount, ... }
 * @param {boolean} [isSourceAccount=true]
 * @returns {Object} Copia de la cuenta con balance actualizado
 */
export function applyMovementToAccount(account, movement, isSourceAccount = true) {
  const delta = calculateBalanceChange({
    accountType: account.type,
    movementType: movement.type,
    amount: movement.amount,
    isSourceAccount,
  })

  return {
    ...account,
    balance: (account.balance || 0) + delta,
  }
}

/**
 * Revierte el efecto de un movimiento sobre una cuenta (para deshacer o editar).
 * @param {Object} account
 * @param {Object} movement
 * @param {boolean} [isSourceAccount=true]
 * @returns {Object} Copia de la cuenta con balance revertido
 */
export function revertMovementFromAccount(account, movement, isSourceAccount = true) {
  const delta = calculateBalanceChange({
    accountType: account.type,
    movementType: movement.type,
    amount: movement.amount,
    isSourceAccount,
  })

  return {
    ...account,
    balance: (account.balance || 0) - delta,
  }
}
