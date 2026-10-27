/**
 * src/domain/summaries.js
 *
 * Lógica pura de agregación financiera y comparativas para Panorama.
 *
 * Reglas:
 *   - Excluye transferencias (las transferencias no son ingresos ni gastos).
 *   - Convierte montos en USD a MXN usando el fxRate del movimiento (o el fallback).
 *   - Todos los montos se devuelven en CENTAVOS ENTEROS.
 *   - Proporciona datos para gráficas (Donut de gastos y Tendencia temporal).
 *   - Compara con el periodo anterior equivalente.
 */

import { convertCurrency } from './currency.js'
import { isDateInRange } from './periods.js'

/**
 * Calcula los resúmenes financieros para un periodo actual y periodo anterior.
 *
 * @param {Object} params
 * @param {Array<Object>} params.movements - Lista de movimientos
 * @param {Array<Object>} params.categories - Lista de categorías
 * @param {string|null} params.startDate - Inicio periodo actual 'YYYY-MM-DD'
 * @param {string|null} params.endDate - Fin periodo actual 'YYYY-MM-DD'
 * @param {string|null} [params.prevStartDate] - Inicio periodo anterior
 * @param {string|null} [params.prevEndDate] - Fin periodo anterior
 * @param {number} [params.fxRate=20.0] - Tipo de cambio de respaldo USD/MXN
 * @returns {Object} Resumen completo
 */
export function calculatePeriodSummaries({
  movements = [],
  categories = [],
  startDate = null,
  endDate = null,
  prevStartDate = null,
  prevEndDate = null,
  fxRate = 20.0,
}) {
  // Mapa de categorías para acceso O(1)
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  let totalIncome = 0
  let totalExpense = 0
  const categoryTotals = new Map() // categoryId -> amount en centavos MXN
  const dailyBuckets = new Map() // date -> { income: 0, expense: 0 }

  // ── Procesar periodo actual ──
  const currentMovements = movements.filter(m => {
    if (m.type === 'transfer' || m.type === 'adjustment') return false
    return isDateInRange(m.date, startDate, endDate)
  })

  currentMovements.forEach(m => {
    // Convertir a MXN en centavos
    const rate = m.fxRate || fxRate
    const amountMXN = convertCurrency(m.amount, rate, m.currency, 'MXN')

    if (m.type === 'income') {
      totalIncome += amountMXN
    } else if (m.type === 'expense') {
      totalExpense += amountMXN

      // Agrupación por categoría
      const catId = m.categoryId || 'uncategorized'
      categoryTotals.set(catId, (categoryTotals.get(catId) || 0) + amountMXN)
    }

    // Tendencia por día
    if (!dailyBuckets.has(m.date)) {
      dailyBuckets.set(m.date, { income: 0, expense: 0 })
    }
    const bucket = dailyBuckets.get(m.date)
    if (m.type === 'income') {
      bucket.income += amountMXN
    } else if (m.type === 'expense') {
      bucket.expense += amountMXN
    }
  })

  const balance = totalIncome - totalExpense

  // ── Desglose por categoría para DonutChart ──
  const categoryBreakdown = []
  categoryTotals.forEach((amount, catId) => {
    const cat = categoryMap.get(catId)
    const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0
    categoryBreakdown.push({
      categoryId: catId,
      name: cat?.name || 'Otros',
      color: cat?.color || '#FF7A1A',
      icon: cat?.icon || 'MoreHorizontal',
      amount, // en centavos
      percentage: Number(percentage.toFixed(1)),
    })
  })

  // Ordenar categorías de mayor a menor gasto
  categoryBreakdown.sort((a, b) => b.amount - a.amount)

  // ── Tendencia cronológica para TrendChart ──
  const sortedDates = Array.from(dailyBuckets.keys()).sort()
  const trendData = sortedDates.map(dateStr => {
    const b = dailyBuckets.get(dateStr)
    return {
      date: dateStr,
      label: dateStr.slice(5), // 'MM-DD'
      income: b.income / 100, // en pesos para Recharts
      expense: b.expense / 100, // en pesos para Recharts
      incomeCents: b.income,
      expenseCents: b.expense,
    }
  })

  // ── Procesar periodo anterior (si existe) ──
  let prevIncome = 0
  let prevExpense = 0
  let hasPrevPeriod = Boolean(prevStartDate && prevEndDate)

  if (hasPrevPeriod) {
    const prevMovements = movements.filter(m => {
      if (m.type === 'transfer' || m.type === 'adjustment') return false
      return isDateInRange(m.date, prevStartDate, prevEndDate)
    })

    prevMovements.forEach(m => {
      const rate = m.fxRate || fxRate
      const amountMXN = convertCurrency(m.amount, rate, m.currency, 'MXN')
      if (m.type === 'income') {
        prevIncome += amountMXN
      } else if (m.type === 'expense') {
        prevExpense += amountMXN
      }
    })
  }

  const prevBalance = prevIncome - prevExpense

  // Cálculo de variación porcentual y absoluta.
  // Si el periodo anterior no tiene datos (previous === 0), se marca como noPrevData
  // para que la UI muestre "Sin datos del periodo anterior" en lugar de "+100%".
  const calculateChange = (current, previous) => {
    const diff = current - previous
    if (previous === 0) {
      return { diff, percent: 0, noPrevData: true }
    }
    const percent = ((current - previous) / previous) * 100
    return { diff, percent: Number(percent.toFixed(1)), noPrevData: false }
  }

  const incomeComparison = hasPrevPeriod ? calculateChange(totalIncome, prevIncome) : null
  const expenseComparison = hasPrevPeriod ? calculateChange(totalExpense, prevExpense) : null
  const balanceComparison = hasPrevPeriod ? calculateChange(balance, prevBalance) : null

  return {
    totalIncome, // centavos MXN
    totalExpense, // centavos MXN
    balance, // centavos MXN
    categoryBreakdown,
    trendData,
    hasPrevPeriod,
    previous: hasPrevPeriod ? {
      totalIncome: prevIncome,
      totalExpense: prevExpense,
      balance: prevBalance,
    } : null,
    comparison: {
      income: incomeComparison,
      expense: expenseComparison,
      balance: balanceComparison,
    },
  }
}
