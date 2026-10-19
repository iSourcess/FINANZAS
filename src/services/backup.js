/**
 * src/services/backup.js
 *
 * Servicio de respaldo e importación de datos:
 *   - Exportar base de datos completa a JSON.
 *   - Exportar movimientos a CSV.
 *   - Importar JSON con validación previa de integridad.
 *   - Compatible con Android (Capacitor Filesystem + Share) y Web (Blob download).
 *
 * Reglas de AGENTS.md:
 *   - Toda lectura/escritura a DB envuelta en try/catch.
 *   - Montos en centavos enteros.
 *   - No romper la app si un plugin no está disponible.
 */

import { db } from '../db/database.js'

/**
 * Helper para descargar archivo en navegador web.
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadFileInBrowser(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Guarda y comparte un archivo en Android nativo usando Capacitor Filesystem y Share.
 * Si falla o no está en nativo, recurre a la descarga web.
 *
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
async function saveAndShareFile(content, filename, mimeType) {
  try {
    const corePkg = '@capacitor/core'
    const coreModule = await import(/* @vite-ignore */ corePkg).catch(() => null)
    const Capacitor = coreModule?.Capacitor || (typeof window !== 'undefined' ? window.Capacitor : null)

    if (Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
      const fsPkg = '@capacitor/filesystem'
      const sharePkg = '@capacitor/share'
      const fsMod = await import(/* @vite-ignore */ fsPkg).catch(() => null)
      const shareMod = await import(/* @vite-ignore */ sharePkg).catch(() => null)

      const Filesystem = fsMod?.Filesystem || Capacitor.Plugins?.Filesystem
      const Share = shareMod?.Share || Capacitor.Plugins?.Share
      const Directory = fsMod?.Directory || { Cache: 'CACHE' }
      const Encoding = fsMod?.Encoding || { UTF8: 'utf8' }

      if (Filesystem && Share) {
        const saved = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        })

        await Share.share({
          title: 'Respaldo Finanzas',
          text: `Archivo de respaldo: ${filename}`,
          url: saved.uri,
          dialogTitle: 'Guardar o compartir respaldo',
        })
        return true
      }
    }
  } catch (err) {
    console.warn('[backupService] Fallback a descarga web:', err)
  }

  // Fallback web
  downloadFileInBrowser(content, filename, mimeType)
  return true
}

/**
 * Exporta toda la base de datos a formato JSON.
 * @returns {Promise<{ filename: string, timestamp: string }>}
 */
export async function exportDatabaseToJSON() {
  try {
    const [accounts, movements, categories, budgets, fixedExpenses, holdings, settings] =
      await Promise.all([
        db.accounts.toArray(),
        db.movements.toArray(),
        db.categories.toArray(),
        db.budgets.toArray(),
        db.fixedExpenses.toArray(),
        db.holdings.toArray(),
        db.settings.toArray(),
      ])

    const timestamp = new Date().toISOString()
    const dateStr = timestamp.slice(0, 10).replace(/-/g, '')
    const timeStr = timestamp.slice(11, 19).replace(/:/g, '')
    const filename = `finanzas_respaldo_${dateStr}_${timeStr}.json`

    const payload = {
      version: 1,
      appName: 'FINANZAS',
      exportedAt: timestamp,
      data: {
        accounts,
        movements,
        categories,
        budgets,
        fixedExpenses,
        holdings,
        settings,
      },
    }

    const jsonString = JSON.stringify(payload, null, 2)
    await saveAndShareFile(jsonString, filename, 'application/json')

    // Actualizar fecha de último respaldo en settings
    try {
      await db.settings.update('global', { lastBackupAt: timestamp })
    } catch {
      // Ignorar si settings no existe aún
    }

    return { filename, timestamp }
  } catch (err) {
    console.error('[backupService] Error al exportar JSON:', err)
    throw new Error('No se pudo generar el respaldo JSON.')
  }
}

/**
 * Exporta el historial de movimientos a formato CSV para Excel/Sheets.
 * @returns {Promise<{ filename: string, count: number }>}
 */
export async function exportMovementsToCSV() {
  try {
    const [movements, categories, accounts] = await Promise.all([
      db.movements.toArray(),
      db.categories.toArray(),
      db.accounts.toArray(),
    ])

    const catMap = new Map(categories.map(c => [c.id, c.name]))
    const accMap = new Map(accounts.map(a => [a.id, a.name]))

    const headers = [
      'ID',
      'Fecha',
      'Tipo',
      'Monto_Pesos',
      'Moneda',
      'Tipo_Cambio',
      'Categoria',
      'Cuenta_Origen',
      'Cuenta_Destino',
      'Nota',
      'MSI_Meses',
      'MSI_Mensualidad_Pesos',
      'Creado_En',
    ]

    const escapeCSV = (str) => {
      if (!str) return '""'
      const sanitized = String(str).replace(/"/g, '""')
      return `"${sanitized}"`
    }

    // Ordenar de más reciente a más antiguo
    const sorted = [...movements].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    const rows = sorted.map(m => {
      const montoPesos = ((m.amount || 0) / 100).toFixed(2)
      const msiMensualidad = m.msi?.monthlyAmount ? ((m.msi.monthlyAmount || 0) / 100).toFixed(2) : ''
      const catName = catMap.get(m.categoryId) || ''
      const originAcc = accMap.get(m.accountId) || ''
      const destAcc = accMap.get(m.toAccountId) || ''

      return [
        escapeCSV(m.id),
        escapeCSV(m.date),
        escapeCSV(m.type),
        montoPesos,
        escapeCSV(m.currency || 'MXN'),
        m.fxRate || 1,
        escapeCSV(catName),
        escapeCSV(originAcc),
        escapeCSV(destAcc),
        escapeCSV(m.note || ''),
        m.msi?.months || '',
        msiMensualidad,
        escapeCSV(m.createdAt),
      ].join(',')
    })

    // BOM UTF-8 (\uFEFF) para que Excel abra acentos en español correctamente
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')

    const timestamp = new Date().toISOString()
    const dateStr = timestamp.slice(0, 10).replace(/-/g, '')
    const timeStr = timestamp.slice(11, 19).replace(/:/g, '')
    const filename = `finanzas_movimientos_${dateStr}_${timeStr}.csv`

    await saveAndShareFile(csvContent, filename, 'text/csv;charset=utf-8')

    return { filename, count: rows.length }
  } catch (err) {
    console.error('[backupService] Error al exportar CSV:', err)
    throw new Error('No se pudo exportar el historial a CSV.')
  }
}

/**
 * Valida el contenido de un archivo JSON de respaldo antes de importar.
 *
 * @param {string} jsonString
 * @returns {{
 *   valid: boolean,
 *   error?: string,
 *   summary?: {
 *     accountsCount: number,
 *     movementsCount: number,
 *     categoriesCount: number,
 *     budgetsCount: number,
 *     fixedExpensesCount: number,
 *     holdingsCount: number,
 *     exportedAt?: string
 *   },
 *   parsedData?: Object
 * }}
 */
export function validateBackupJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString)

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'El archivo no tiene un formato JSON válido.' }
    }

    // Acepta formato { version, appName, data: { ... } } o directamente el objeto de datos
    const data = parsed.data || parsed

    if (!data.movements && !data.accounts && !data.categories) {
      return {
        valid: false,
        error: 'El archivo no contiene datos compatibles de Finanzas (no se encontraron movimientos ni cuentas).',
      }
    }

    const summary = {
      accountsCount: Array.isArray(data.accounts) ? data.accounts.length : 0,
      movementsCount: Array.isArray(data.movements) ? data.movements.length : 0,
      categoriesCount: Array.isArray(data.categories) ? data.categories.length : 0,
      budgetsCount: Array.isArray(data.budgets) ? data.budgets.length : 0,
      fixedExpensesCount: Array.isArray(data.fixedExpenses) ? data.fixedExpenses.length : 0,
      holdingsCount: Array.isArray(data.holdings) ? data.holdings.length : 0,
      exportedAt: parsed.exportedAt || null,
    }

    return { valid: true, summary, parsedData: data }
  } catch (err) {
    return { valid: false, error: `Error al leer JSON: ${err.message}` }
  }
}

/**
 * Restaura toda la base de datos reemplazando los datos actuales con los del respaldo validado.
 *
 * @param {Object} data - Objeto de datos previamente validado con validateBackupJSON
 */
export async function restoreDatabase(data) {
  try {
    await db.transaction(
      'rw',
      [
        db.accounts,
        db.movements,
        db.categories,
        db.budgets,
        db.fixedExpenses,
        db.holdings,
        db.settings,
      ],
      async () => {
        // 1. Limpiar tablas existentes
        await Promise.all([
          db.accounts.clear(),
          db.movements.clear(),
          db.categories.clear(),
          db.budgets.clear(),
          db.fixedExpenses.clear(),
          db.holdings.clear(),
        ])

        // 2. Restaurar registros
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          await db.categories.bulkAdd(data.categories)
        }
        if (Array.isArray(data.accounts) && data.accounts.length > 0) {
          await db.accounts.bulkAdd(data.accounts)
        }
        if (Array.isArray(data.movements) && data.movements.length > 0) {
          await db.movements.bulkAdd(data.movements)
        }
        if (Array.isArray(data.budgets) && data.budgets.length > 0) {
          await db.budgets.bulkAdd(data.budgets)
        }
        if (Array.isArray(data.fixedExpenses) && data.fixedExpenses.length > 0) {
          await db.fixedExpenses.bulkAdd(data.fixedExpenses)
        }
        if (Array.isArray(data.holdings) && data.holdings.length > 0) {
          await db.holdings.bulkAdd(data.holdings)
        }
        if (Array.isArray(data.settings) && data.settings.length > 0) {
          await db.settings.bulkPut(data.settings)
        } else if (data.settings && typeof data.settings === 'object') {
          await db.settings.put(data.settings)
        }
      }
    )

    return true
  } catch (err) {
    console.error('[backupService] Error al restaurar base de datos:', err)
    throw new Error('Fallo crítico al restaurar la base de datos.')
  }
}
