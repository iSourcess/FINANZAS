import { describe, it, expect } from 'vitest'
import { db } from '../src/db/database.js'

describe('Database: Dexie v13 migration & detection rules / pending detections tables', () => {
  it('confirms the production db schema is at version 13', () => {
    expect(db.verno).toBe(13)

    const rulesTable = db.detectionRules
    expect(rulesTable).toBeDefined()
    expect(rulesTable.schema.primKey.name).toBe('id')
    expect(rulesTable.schema.primKey.auto).toBe(true)

    const ruleIndexes = rulesTable.schema.indexes.map(idx => idx.name)
    expect(ruleIndexes).toContain('packageName')
    expect(ruleIndexes).toContain('accountId')
    expect(ruleIndexes).toContain('enabled')
    expect(ruleIndexes).toContain('priority')

    const pendingTable = db.pendingDetections
    expect(pendingTable).toBeDefined()
    expect(pendingTable.schema.primKey.name).toBe('id')
    expect(pendingTable.schema.primKey.auto).toBe(true)

    const pendingIndexes = pendingTable.schema.indexes.map(idx => idx.name)
    expect(pendingIndexes).toContain('packageName')
    expect(pendingIndexes).toContain('postedAt')
    expect(pendingIndexes).toContain('detectedAt')
    expect(pendingIndexes).toContain('status')
    expect(pendingIndexes).toContain('accountId')
    expect(pendingIndexes).toContain('duplicateOf')
  })
})

