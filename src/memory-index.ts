import { existsSync } from "node:fs"
import type { Memory, MemorySearchOptions, MemorySearchResult, MemoryScope } from "./types"
import { getScopeDir, getDbPath, ensureDir } from "./utils/paths"
import { computeSnippet } from "./utils/filter"

type SqliteDb = {
  exec(sql: string): void
  prepare(sql: string): {
    all(...params: unknown[]): Record<string, unknown>[]
    get(...params: unknown[]): Record<string, unknown> | undefined
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
  }
  close(): void
}

let SqliteDatabase: { new(path: string, opts?: { create?: boolean; readonly?: boolean }): SqliteDb } | null = null

function getBunSqlite() {
  if (SqliteDatabase) return SqliteDatabase
  try {
    // @ts-ignore - bun:sqlite is a Bun built-in module
    const { Database } = require("bun:sqlite")
    SqliteDatabase = Database
    return SqliteDatabase
  } catch {
    return null
  }
}

const FTS5_CREATE = `
  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    type,
    scope,
    status,
    tags,
    tokenize='porter unicode61'
  )
`

const FTS5_INSERT = `INSERT INTO memories_fts (id, title, content, type, scope, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?)`
const FTS5_DELETE = `DELETE FROM memories_fts WHERE id = ?`
const FTS5_DELETE_ALL = `DELETE FROM memories_fts`
const FTS5_SEARCH = `
  SELECT id, rank FROM memories_fts
  WHERE memories_fts MATCH ?
  ORDER BY rank
  LIMIT ? OFFSET ?
`
const FTS5_REMOVE_BY_SCOPE = `DELETE FROM memories_fts WHERE scope = ?`

export class FtsMemoryIndex {
  private projectDir: string
  private initialized = false

  constructor(projectDir: string) {
    this.projectDir = projectDir
  }

  init(): void {
    if (this.initialized) return
    const DB = getBunSqlite()
    if (!DB) {
      this.initialized = true
      return
    }

    for (const scope of ["project", "global"] as MemoryScope[]) {
      const base = getScopeDir(this.projectDir, scope)
      ensureDir(base)
      const dbPath = getDbPath(base)

      try {
        const db = new DB(dbPath, { create: true })
        db.exec("PRAGMA journal_mode=WAL")
        db.exec(FTS5_CREATE)
        db.close()
      } catch {
        // Fall back to file-based search if FTS5 init fails
      }
    }
    this.initialized = true
  }

  index(memory: Memory): void {
    this.init()
    const DB = getBunSqlite()
    if (!DB) return

    const db = this.openDb(DB, memory.scope, false)
    if (!db) return

    try {
      const stmt = db.prepare(FTS5_INSERT)
      stmt.run(
        memory.id,
        memory.title,
        memory.content,
        memory.type,
        memory.scope,
        memory.status,
        memory.tags.join(" "),
      )
    } finally {
      db.close()
    }
  }

  remove(id: string, scope: MemoryScope): void {
    const DB = getBunSqlite()
    if (!DB) return

    const db = this.openDb(DB, scope, false)
    if (!db) return

    try {
      const stmt = db.prepare(FTS5_DELETE)
      stmt.run(id)
    } finally {
      db.close()
    }
  }

  search(memories: Memory[], opts: MemorySearchOptions): MemorySearchResult[] {
    this.init()
    const { query, type, scope, limit = 10, offset = 0 } = opts

    if (!query) {
      return memories
        .filter((m) => {
          if (type && m.type !== type) return false
          if (scope && m.scope !== scope) return false
          return true
        })
        .slice(offset, offset + limit)
        .map((m) => ({
          memory: m,
          score: 1.0,
          snippet: computeSnippet(`${m.title} ${m.content}`, ""),
        }))
    }

    const DB = getBunSqlite()
    if (!DB) {
      return this.fallbackSearch(memories, opts)
    }

    const db = this.openDb(DB, scope ?? "project")
    if (!db) {
      return this.fallbackSearch(memories, opts)
    }

    try {
      const ftsQuery = this.buildFtsQuery(query)
      const searchStmt = type
        ? db.prepare(`${FTS5_SEARCH} AND type = ?`)
        : db.prepare(FTS5_SEARCH)

      const params = type
        ? [ftsQuery, type, limit, offset]
        : [ftsQuery, limit, offset]

      const resultRows = searchStmt.all(...params) as { id: string; rank: number }[]
      const memoryMap = new Map(memories.map((m) => [m.id, m]))

      return resultRows
        .map((row) => {
          const memory = memoryMap.get(row.id)
          if (!memory) return null
          const score = 1.0 / (1.0 + Math.abs(row.rank))
          return {
            memory,
            score: Math.max(0, Math.min(1, score)),
            snippet: computeSnippet(`${memory.title} ${memory.content}`, query),
          }
        })
        .filter((r): r is MemorySearchResult => r !== null)
        .sort((a, b) => b.score - a.score)
    } finally {
      db.close()
    }
  }

  rebuild(scope: MemoryScope, memories: Memory[]): void {
    this.init()
    const DB = getBunSqlite()
    if (!DB) return

    const db = this.openDb(DB, scope, false)
    if (!db) return

    try {
      const deleteStmt = db.prepare(FTS5_DELETE_ALL)
      deleteStmt.run()

      const stmt = db.prepare(FTS5_INSERT)
      for (const memory of memories) {
        stmt.run(
          memory.id,
          memory.title,
          memory.content,
          memory.type,
          memory.scope,
          memory.status,
          memory.tags.join(" "),
        )
      }
    } finally {
      db.close()
    }
  }

  clearScope(scope: MemoryScope): void {
    const DB = getBunSqlite()
    if (!DB) return

    const db = this.openDb(DB, scope, false)
    if (!db) return

    try {
      db.exec(FTS5_REMOVE_BY_SCOPE)
    } finally {
      db.close()
    }
  }

  private openDb(DB: { new(path: string, opts?: { create?: boolean; readonly?: boolean }): SqliteDb }, scope: MemoryScope, readonly: boolean = true): SqliteDb | null {
    const base = getScopeDir(this.projectDir, scope)
    const dbPath = getDbPath(base)
    if (!existsSync(dbPath)) return null

    try {
      if (readonly) {
        return new DB(dbPath, { readonly: true })
      }
      return new DB(dbPath)
    } catch {
      return null
    }
  }

  private fallbackSearch(memories: Memory[], opts: MemorySearchOptions): MemorySearchResult[] {
    const { query, type, scope, limit = 10 } = opts
    const q = query?.toLowerCase() ?? ""

    return memories
      .filter((m) => {
        if (type && m.type !== type) return false
        if (scope && m.scope !== scope) return false
        if (!q) return true
        const haystack = `${m.title} ${m.content} ${m.tags.join(" ")}`.toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, limit)
      .map((m) => ({
        memory: m,
        score: q ? 0.5 : 1.0,
        snippet: computeSnippet(`${m.title} ${m.content}`, q),
      }))
  }

  private buildFtsQuery(query: string): string {
    return query
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `"${word.replace(/"/g, '""')}"`)
      .join(" OR ")
  }
}
