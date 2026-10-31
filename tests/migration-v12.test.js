import { describe, it, expect } from 'vitest'
import { db } from '../src/db/database.js'

describe('Database: Dexie v12 migration & rawSamples table', () => {
  it('confirms the production db schema is at version 12', () => {
    expect(db.verno).toBe(12)

    const rawSamplesTable = db.rawSamples
    expect(rawSamplesTable).toBeDefined()
    expect(rawSamplesTable.schema.primKey.name).toBe('id')
    expect(rawSamplesTable.schema.primKey.auto).toBe(true)

    const indexNames = rawSamplesTable.schema.indexes.map(idx => idx.name)
    expect(indexNames).toContain('packageName')
    expect(indexNames).toContain('postTime')
    expect(indexNames).toContain('createdAt')
  })
})

