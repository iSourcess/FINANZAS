import { describe, it, expect } from 'vitest'
import {
  decodeCsvBuffer,
  detectDelimiter,
  parseCsvRows,
  normalizeDate,
  normalizeAmount,
  normalizeDescription,
  matchCategoryRules,
  detectDuplicates,
  calculateImportSummary,
} from '../src/domain/importer.js'
import fs from 'node:fs'
import path from 'node:path'

describe('CSV Importer Domain Logic', () => {
  describe('decodeCsvBuffer', () => {
    it('decodes UTF-8 string properly', () => {
      const buffer = new TextEncoder().encode('Fecha,Monto,Descripción\n15/10/2026,100,Café')
      const result = decodeCsvBuffer(buffer.buffer)
      expect(result).toContain('Café')
    })

    it('strips UTF-8 BOM if present', () => {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf])
      const text = new TextEncoder().encode('Fecha,Monto\n2026-10-01,50')
      const combined = new Uint8Array(bom.length + text.length)
      combined.set(bom)
      combined.set(text, bom.length)

      const result = decodeCsvBuffer(combined.buffer)
      expect(result.charCodeAt(0)).not.toBe(0xfeff)
      expect(result.startsWith('Fecha,Monto')).toBe(true)
    })
  })

  describe('detectDelimiter', () => {
    it('detects comma delimiter', () => {
      const csv = 'Fecha,Concepto,Monto\n2026-10-01,OXXO,50.00\n2026-10-02,Uber,120.00'
      expect(detectDelimiter(csv)).toBe(',')
    })

    it('detects semicolon delimiter', () => {
      const csv = 'Fecha;Concepto;Importe\n2026-10-01;Super;-45,80\n2026-10-02;Luz;-120,40'
      expect(detectDelimiter(csv)).toBe(';')
    })

    it('detects tab delimiter', () => {
      const csv = 'Fecha\tConcepto\tMonto\n2026-10-01\tGas\t500.00\n2026-10-02\tAgua\t250.00'
      expect(detectDelimiter(csv)).toBe('\t')
    })
  })

  describe('parseCsvRows', () => {
    it('parses basic CSV rows correctly', () => {
      const csv = 'ColA,ColB,ColC\nVal1,Val2,Val3\nVal4,Val5,Val6'
      const rows = parseCsvRows(csv, ',')
      expect(rows).toHaveLength(3)
      expect(rows[0]).toEqual(['ColA', 'ColB', 'ColC'])
      expect(rows[1]).toEqual(['Val1', 'Val2', 'Val3'])
    })

    it('handles quoted fields with commas and escaped quotes', () => {
      const csv = 'Fecha,Nota,Monto\n2026-10-01,"Restaurante, ""El Buen Sabor""",-250.00'
      const rows = parseCsvRows(csv, ',')
      expect(rows).toHaveLength(2)
      expect(rows[1][1]).toBe('Restaurante, "El Buen Sabor"')
      expect(rows[1][2]).toBe('-250.00')
    })

    it('parses fixture files properly', () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/fake_bank_mexico.csv')
      const content = fs.readFileSync(fixturePath, 'utf-8')
      const rows = parseCsvRows(content, ',')
      expect(rows.length).toBeGreaterThan(3)
      expect(rows[0]).toEqual(['Fecha', 'Descripcion', 'Monto', 'Referencia'])
    })
  })

  describe('normalizeDate', () => {
    it('normalizes dd/MM/yyyy to yyyy-MM-dd', () => {
      expect(normalizeDate('15/10/2026', 'dd/MM/yyyy')).toBe('2026-10-15')
      expect(normalizeDate('05-03-2026', 'dd/MM/yyyy')).toBe('2026-03-05')
    })

    it('normalizes MM/dd/yyyy to yyyy-MM-dd', () => {
      expect(normalizeDate('10/15/2026', 'MM/dd/yyyy')).toBe('2026-10-15')
    })

    it('normalizes yyyy-MM-dd', () => {
      expect(normalizeDate('2026-10-15', 'yyyy-MM-dd')).toBe('2026-10-15')
    })

    it('normalizes Spanish month names in dd-MMM-yyyy format', () => {
      expect(normalizeDate('15-oct-2026', 'dd-MMM-yyyy')).toBe('2026-10-15')
      expect(normalizeDate('05-ENE-26', 'dd-MMM-yyyy')).toBe('2026-01-05')
    })

    it('returns null for invalid strings', () => {
      expect(normalizeDate('invalido')).toBeNull()
      expect(normalizeDate('')).toBeNull()
    })
  })

  describe('normalizeAmount', () => {
    it('normalizes negative and positive amounts into cents', () => {
      const expense = normalizeAmount({ amountStr: '-65.50' })
      expect(expense.amountCents).toBe(6550)
      expect(expense.type).toBe('expense')

      const income = normalizeAmount({ amountStr: '1500.00' })
      expect(income.amountCents).toBe(150000)
      expect(income.type).toBe('income')
    })

    it('handles parentheses negative notation (120.00)', () => {
      const res = normalizeAmount({ amountStr: '(120.50)' })
      expect(res.amountCents).toBe(12050)
      expect(res.type).toBe('expense')
    })

    it('handles European comma decimal 1.250,50', () => {
      const res = normalizeAmount({
        amountStr: '-1.250,50',
        decimalSep: ',',
        thousandSep: '.',
      })
      expect(res.amountCents).toBe(125050)
      expect(res.type).toBe('expense')
    })

    it('supports invertSign option for credit card statements', () => {
      // In credit cards, positive number is often a purchase/charge
      const res = normalizeAmount({
        amountStr: '450.00',
        invertSign: true,
      })
      expect(res.amountCents).toBe(45000)
      expect(res.type).toBe('expense')
    })

    it('handles two columns cargo/abono mode', () => {
      const cargo = normalizeAmount({
        mode: 'twoColumns',
        chargeStr: '850.50',
        creditStr: '',
      })
      expect(cargo.amountCents).toBe(85050)
      expect(cargo.type).toBe('expense')

      const abono = normalizeAmount({
        mode: 'twoColumns',
        chargeStr: '',
        creditStr: '15000.00',
      })
      expect(abono.amountCents).toBe(1500000)
      expect(abono.type).toBe('income')
    })
  })

  describe('matchCategoryRules', () => {
    const rules = [
      { keyword: 'oxxo', categoryId: 'cat-comida', hitCount: 15 },
      { keyword: 'uber', categoryId: 'cat-transporte', hitCount: 20 },
      { keyword: 'farmacia', categoryId: 'cat-salud', hitCount: 5 },
    ]

    it('matches keyword inside description', () => {
      const cat = matchCategoryRules('COMPRA OXXO INSURGENTES', rules)
      expect(cat).toBe('cat-comida')
    })

    it('returns null if no keyword matches', () => {
      const cat = matchCategoryRules('TIENDA DESCONOCIDA', rules)
      expect(cat).toBeNull()
    })
  })

  describe('detectDuplicates and calculateImportSummary', () => {
    const existing = [
      { accountId: 'acc-1', date: '2026-10-15', amount: 6550, note: 'OXXO INSURGENTES', type: 'expense' },
    ]

    const parsedRows = [
      { id: '1', date: '2026-10-15', amount: 6550, note: 'OXXO INSURGENTES', type: 'expense' },
      { id: '2', date: '2026-10-16', amount: 9800, note: 'STARBUCKS', type: 'expense' },
      { id: '3', date: '2026-10-17', amount: 150000, note: 'NOMINA', type: 'income' },
      { id: '4', date: '2026-10-16', amount: 9800, note: 'STARBUCKS', type: 'expense' }, // duplicate inside batch
    ]

    it('detects existing and intra-batch duplicates and deselects them by default', () => {
      const enriched = detectDuplicates(parsedRows, existing, 'acc-1')
      expect(enriched[0].isDuplicate).toBe(true)
      expect(enriched[0].selected).toBe(false)

      expect(enriched[1].isDuplicate).toBe(false)
      expect(enriched[1].selected).toBe(true)

      expect(enriched[2].isDuplicate).toBe(false)
      expect(enriched[2].selected).toBe(true)

      // Row 4 is duplicate of Row 2 within the same batch
      expect(enriched[3].isDuplicate).toBe(true)
      expect(enriched[3].selected).toBe(false)
    })

    it('calculates totals correctly based on selected rows', () => {
      const enriched = detectDuplicates(parsedRows, existing, 'acc-1')
      const summary = calculateImportSummary(enriched)

      expect(summary.totalRows).toBe(4)
      expect(summary.duplicateCount).toBe(2)
      expect(summary.selectedCount).toBe(2)
      expect(summary.totalExpenseCents).toBe(9800)
      expect(summary.totalIncomeCents).toBe(150000)
      expect(summary.netCents).toBe(150000 - 9800)
    })
  })
})
