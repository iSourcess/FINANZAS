/**
 * src/domain/importer.js
 *
 * Lógica pura para importación de movimientos bancarios desde archivos CSV.
 * SIN dependencias de React ni de base de datos.
 *
 * Reglas:
 *   - Montos siempre en CENTAVOS ENTEROS.
 *   - Fechas en hora local como "YYYY-MM-DD" (sin toISOString).
 *   - Decodificación UTF-8 / windows-1252 y remoción de BOM.
 *   - Manejo de delimitadores (coma, punto y coma, tabulador).
 *   - Normalización de números con signo, paréntesis o columnas separadas cargo/abono.
 *   - Detección de duplicados contra la base de datos y dentro del mismo archivo.
 */

/* ── Mapeo de meses en español para dd-MMM-yyyy ────────────── */
const SPANISH_MONTHS = {
  ene: '01',
  feb: '02',
  mar: '03',
  abr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  sep: '09',
  set: '09',
  oct: '10',
  nov: '11',
  dic: '12',
  jan: '01',
  apr: '04',
  aug: '08',
  dec: '12',
}

/**
 * Decodifica un ArrayBuffer a string intentando UTF-8 primero;
 * si falla por caracteres inválidos, usa windows-1252.
 * Remueve el Byte Order Mark (BOM) UTF-8 (\uFEFF) si está presente.
 *
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function decodeCsvBuffer(buffer) {
  if (!buffer || buffer.byteLength === 0) return ''

  let text = ''
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    text = utf8Decoder.decode(buffer)
  } catch {
    // Fallback a windows-1252 común en exportaciones de bancos latinoamericanos
    const winDecoder = new TextDecoder('windows-1252')
    text = winDecoder.decode(buffer)
  }

  // Ignorar BOM si existe
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }

  return text
}

/**
 * Detecta automáticamente el delimitador de un texto CSV (',', ';', '\t').
 * Analiza las primeras líneas del archivo y escoge el delimitador
 * con frecuencia más consistente mayor a 0.
 *
 * @param {string} rawText
 * @returns {',' | ';' | '\t'}
 */
export function detectDelimiter(rawText) {
  if (!rawText) return ','

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10)

  if (lines.length === 0) return ','

  const candidates = [',', ';', '\t']
  const scores = candidates.map((delim) => {
    const counts = lines.map((line) => {
      // Contar apariciones fuera de comillas simples
      let count = 0
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes
        else if (line[i] === delim && !inQuotes) count++
      }
      return count
    })

    const allPositive = counts.every((c) => c > 0)
    const firstCount = counts[0] || 0
    const isUniform = counts.every((c) => c === firstCount && c > 0)

    return {
      delim,
      allPositive,
      isUniform,
      total: counts.reduce((a, b) => a + b, 0),
    }
  })

  // Prioridad: uniforme > todos positivos > mayor total
  const uniform = scores.find((s) => s.isUniform)
  if (uniform) return uniform.delim

  const positive = scores.filter((s) => s.allPositive).sort((a, b) => b.total - a.total)
  if (positive.length > 0) return positive[0].delim

  scores.sort((a, b) => b.total - a.total)
  return scores[0]?.total > 0 ? scores[0].delim : ','
}

/**
 * Parsea un texto CSV respetando RFC 4180 (comillas, comas internas, saltos de línea).
 * Devuelve un arreglo bidimensional de celdas string sin espacios residuales al inicio/fin.
 *
 * @param {string} rawText
 * @param {string} [delimiter=',']
 * @returns {string[][]}
 */
export function parseCsvRows(rawText, delimiter = ',') {
  if (!rawText) return []

  const rows = []
  let currentRow = []
  let currentCell = ''
  let inQuotes = false

  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Comilla doble escapada "" -> "
        currentCell += '"'
        i++
      } else {
        // Alternar estado de comillas
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim())
      // Ignorar filas totalmente vacías
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
    } else {
      currentCell += char
    }
  }

  // Última celda y fila
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

/**
 * Normaliza una cadena de fecha a formato ISO local "YYYY-MM-DD".
 * Formatos soportados:
 *   - 'dd/MM/yyyy' o 'dd-MM-yyyy'
 *   - 'yyyy-MM-dd' o 'yyyy/MM/dd'
 *   - 'MM/dd/yyyy' o 'MM-dd-yyyy'
 *   - 'dd-MMM-yyyy' (ej: 15-oct-2026, 05-NOV-26)
 *   - 'auto': deduce por posición y separador
 *
 * @param {string} dateStr
 * @param {string} [format='auto']
 * @returns {string|null} "YYYY-MM-DD" o null si no es válida.
 */
export function normalizeDate(dateStr, format = 'auto') {
  if (!dateStr || typeof dateStr !== 'string') return null
  const cleaned = dateStr.trim()
  if (!cleaned) return null

  // Si ya viene como YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned
  }

  // Formato con mes en texto: 15-Oct-2026, 15/ene/2026, 15-oct-26
  const textMonthMatch = cleaned.match(/^(\d{1,2})[-/\s]([a-zA-Z]{3,4})[-/\s](\d{2,4})$/)
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0')
    const monthKey = textMonthMatch[2].toLowerCase().slice(0, 3)
    const month = SPANISH_MONTHS[monthKey] || '01'
    let year = textMonthMatch[3]
    if (year.length === 2) {
      year = `20${year}`
    }
    return `${year}-${month}-${day}`
  }

  // Separar números
  const parts = cleaned.split(/[-/.]/).map((p) => p.trim())
  if (parts.length !== 3) return null

  let [p1, p2, p3] = parts

  // Si el año viene en 2 dígitos, asumir 20XX
  if (p3.length === 2) p3 = `20${p3}`
  if (p1.length === 2 && p3.length === 4 && format === 'yyyy-MM-dd') {
    // p1 no es año si tiene 2 dígitos
  } else if (p1.length === 2 && (format.startsWith('yyyy') || p1.length === 4)) {
    if (p1.length === 2) p1 = `20${p1}`
  }

  let year = ''
  let month = ''
  let day = ''

  if (format === 'yyyy-MM-dd' || p1.length === 4) {
    year = p1
    month = p2.padStart(2, '0')
    day = p3.padStart(2, '0')
  } else if (format === 'MM/dd/yyyy') {
    year = p3
    month = p1.padStart(2, '0')
    day = p2.padStart(2, '0')
  } else {
    // Por defecto en México y Latinoamérica: dd/MM/yyyy
    year = p3
    month = p2.padStart(2, '0')
    day = p1.padStart(2, '0')
  }

  // Validar rangos numéricos
  const yNum = Number(year)
  const mNum = Number(month)
  const dNum = Number(day)

  if (isNaN(yNum) || isNaN(mNum) || isNaN(dNum)) return null
  if (yNum < 1900 || yNum > 2100) return null
  if (mNum < 1 || mNum > 12) return null
  if (dNum < 1 || dNum > 31) return null

  return `${year}-${month}-${day}`
}

/**
 * Normaliza un monto a centavos enteros y determina si es gasto o ingreso.
 * Maneja:
 *   - Formato latino/US: 1,234.56
 *   - Formato europeo: 1.234,56
 *   - Negativos entre paréntesis: (120.00) -> -12000
 *   - Signo negativo al final: 120.00-
 *   - Inversión de signo (habitual en estados de cuenta de tarjetas de crédito).
 *   - Modo una sola columna con signo vs columnas separadas de cargo/abono.
 *
 * @param {Object} options
 * @param {string} [options.amountStr='']
 * @param {string} [options.mode='single'] 'single' | 'twoColumns'
 * @param {string} [options.chargeStr=''] Cargo (usado en 'twoColumns')
 * @param {string} [options.creditStr=''] Abono (usado en 'twoColumns')
 * @param {string} [options.decimalSep='.'] '.' | ','
 * @param {string} [options.thousandSep=','] ',' | '.' | ' '
 * @param {boolean} [options.invertSign=false] Invertir signo (positivo <-> negativo)
 * @returns {{ amountCents: number, type: 'expense' | 'income' | 'zero', rawSign: number }}
 */
export function normalizeAmount({
  amountStr = '',
  mode = 'single',
  chargeStr = '',
  creditStr = '',
  decimalSep = '.',
  thousandSep = ',',
  invertSign = false,
}) {
  /** Helper interno para limpiar y parsear número */
  const parseNumber = (raw) => {
    if (!raw) return 0
    let str = String(raw).trim()
    if (!str) return 0

    // Detectar si está entre paréntesis: (120.50)
    let isParenthesesNegative = false
    if (/^\(.*\)$/.test(str)) {
      isParenthesesNegative = true
      str = str.replace(/[()]/g, '')
    }

    // Detectar signo negativo al inicio o al final: -120 o 120-
    let isExplicitNegative = false
    if (str.startsWith('-')) {
      isExplicitNegative = true
      str = str.slice(1)
    } else if (str.endsWith('-')) {
      isExplicitNegative = true
      str = str.slice(0, -1)
    } else if (str.startsWith('+')) {
      str = str.slice(1)
    }

    // Quitar símbolos de moneda y letras ($ MXN USD etc.)
    str = str.replace(/[^0-9.,]/g, '')

    if (!str) return 0

    // Si el separador decimal es coma, quitar puntos y reemplazar coma por punto
    if (decimalSep === ',') {
      str = str.replace(/\./g, '')
      str = str.replace(/,/g, '.')
    } else {
      // Separador decimal es punto, quitar comas de miles
      str = str.replace(/,/g, '')
    }

    let num = Number(str)
    if (isNaN(num)) return 0

    if (isParenthesesNegative || isExplicitNegative) {
      num = -Math.abs(num)
    }

    return num
  }

  if (mode === 'twoColumns') {
    const chargeVal = parseNumber(chargeStr)
    const creditVal = parseNumber(creditStr)

    if (chargeVal > 0) {
      // Hay cargo -> gasto
      const cents = Math.round(chargeVal * 100)
      return {
        amountCents: cents,
        type: invertSign ? 'income' : 'expense',
        rawSign: -1,
      }
    }

    if (creditVal > 0) {
      // Hay abono -> ingreso
      const cents = Math.round(creditVal * 100)
      return {
        amountCents: cents,
        type: invertSign ? 'expense' : 'income',
        rawSign: 1,
      }
    }

    return { amountCents: 0, type: 'zero', rawSign: 0 }
  }

  // Modo columna única con signo
  let num = parseNumber(amountStr)
  if (invertSign) {
    num = -num
  }

  const cents = Math.round(Math.abs(num) * 100)
  if (cents === 0) {
    return { amountCents: 0, type: 'zero', rawSign: 0 }
  }

  // En la convención estándar bancaria:
  // Negativo = Cargo/Salida de dinero = Gasto
  // Positivo = Abono/Entrada de dinero = Ingreso
  const type = num < 0 ? 'expense' : 'income'
  return {
    amountCents: cents,
    type,
    rawSign: num < 0 ? -1 : 1,
  }
}

/**
 * Limpia y normaliza una descripción para comparación y reglas.
 *
 * @param {string} desc
 * @returns {string}
 */
export function normalizeDescription(desc) {
  if (!desc || typeof desc !== 'string') return ''
  return desc
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Busca si alguna regla de categoría coincide con la descripción de la fila.
 * Retorna el categoryId de la regla con mayor hitCount que coincida.
 *
 * @param {string} description
 * @param {Array<{ keyword: string, categoryId: string, hitCount?: number }>} rules
 * @returns {string|null} categoryId sugerido o null
 */
export function matchCategoryRules(description, rules = []) {
  if (!description || !Array.isArray(rules) || rules.length === 0) return null

  const normalized = normalizeDescription(description)

  // Filtrar reglas cuya palabra clave esté contenida en la descripción
  const matches = rules.filter((r) => {
    if (!r.keyword || !r.categoryId) return false
    const kw = r.keyword.trim().toLowerCase()
    return kw.length > 0 && normalized.includes(kw)
  })

  if (matches.length === 0) return null

  // Ordenar por hitCount descendente, luego por longitud de keyword descendente (más específica)
  matches.sort((a, b) => {
    const hitsA = a.hitCount ?? 0
    const hitsB = b.hitCount ?? 0
    if (hitsB !== hitsA) return hitsB - hitsA
    return (b.keyword?.length ?? 0) - (a.keyword?.length ?? 0)
  })

  return matches[0].categoryId
}

/**
 * Detecta duplicados entre las filas parseadas y los movimientos existentes en la base de datos,
 * así como duplicados internos dentro del mismo archivo CSV.
 *
 * Un movimiento se considera duplicado si coincide exactamente en:
 *   - accountId
 *   - date (YYYY-MM-DD)
 *   - amount (centavos enteros)
 *   - normalizedDescription
 *
 * @param {Array<Object>} rows Filas parseadas preliminares
 * @param {Array<Object>} existingMovements Movimientos existentes en DB
 * @param {string} targetAccountId ID de la cuenta destino
 * @returns {Array<Object>} Mismas filas enriquecidas con isDuplicate y selected
 */
export function detectDuplicates(rows, existingMovements = [], targetAccountId) {
  // Crear conjunto de llaves de los movimientos existentes en la cuenta
  const existingSet = new Set()
  for (const m of existingMovements) {
    if (m.accountId === targetAccountId && m.type !== 'adjustment') {
      const key = `${m.date}_${m.amount}_${normalizeDescription(m.note || '')}`
      existingSet.add(key)
    }
  }

  // Llevar registro de ocurrencias dentro del mismo CSV
  const seenInBatch = new Map()

  return rows.map((row) => {
    const key = `${row.date}_${row.amount}_${normalizeDescription(row.note || '')}`

    const isDuplicateOfExisting = existingSet.has(key)
    const previousOccurrences = seenInBatch.get(key) || 0
    seenInBatch.set(key, previousOccurrences + 1)
    const isDuplicateInBatch = previousOccurrences > 0

    const isDuplicate = isDuplicateOfExisting || isDuplicateInBatch

    return {
      ...row,
      isDuplicate,
      // Los duplicados salen desmarcados por defecto para que el usuario los revise
      selected: !isDuplicate && row.type !== 'zero',
    }
  })
}

/**
 * Calcula el resumen de lo que se va a importar.
 *
 * @param {Array<Object>} rows
 * @returns {{
 *   totalRows: number,
 *   selectedCount: number,
 *   duplicateCount: number,
 *   totalExpenseCents: number,
 *   totalIncomeCents: number,
 *   netCents: number
 * }}
 */
export function calculateImportSummary(rows = []) {
  let selectedCount = 0
  let duplicateCount = 0
  let totalExpenseCents = 0
  let totalIncomeCents = 0

  for (const r of rows) {
    if (r.isDuplicate) duplicateCount++
    if (r.selected) {
      selectedCount++
      if (r.type === 'expense') {
        totalExpenseCents += r.amount || 0
      } else if (r.type === 'income') {
        totalIncomeCents += r.amount || 0
      }
    }
  }

  return {
    totalRows: rows.length,
    selectedCount,
    duplicateCount,
    totalExpenseCents,
    totalIncomeCents,
    netCents: totalIncomeCents - totalExpenseCents,
  }
}
