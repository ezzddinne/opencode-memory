import { readFile, writeFile, readdir } from "node:fs/promises"
import { existsSync, type Dirent } from "node:fs"
import { join } from "node:path"
import type { Memory, MemoryInput, MemoryStore, MemorySearchOptions, MemoryScope } from "./types"
import { generateMemoryId } from "./utils/id"
import {
  getScopeDir,
  getEntriesDir,
  getSessionsDir,
  getIndexFilePath,
  ensureDir,
} from "./utils/paths"
import { parseMemoryFile, serializeMemory, getEntryFilename, getDateDir, buildIndexMarkdown } from "./utils/markdown"
import { matchesFilter } from "./utils/filter"

export class FileMemoryStore implements MemoryStore {
  private projectDir: string
  private initialized = false

  constructor(projectDir: string) {
    this.projectDir = projectDir
  }

  async init(): Promise<void> {
    if (this.initialized) return
    for (const scope of ["project", "global"] as MemoryScope[]) {
      const base = getScopeDir(this.projectDir, scope)
      ensureDir(base)
      ensureDir(getEntriesDir(base))
      ensureDir(getSessionsDir(base))
    }
    this.initialized = true
  }

  async write(input: MemoryInput): Promise<Memory> {
    await this.init()

    const scope = input.scope ?? "project"
    const now = new Date().toISOString()
    const id = generateMemoryId(input.type)

    const memory: Memory = {
      id,
      type: input.type,
      scope,
      status: "active",
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      created: now,
      updated: now,
      supersedes: input.supersedes ?? [],
      sources: input.sources ?? [],
    }

    const baseDir = getScopeDir(this.projectDir, scope)
    const filePath = join(getEntriesDir(baseDir), getDateDir(now), getEntryFilename(memory))
    ensureDir(getEntriesDir(baseDir))

    // Ensure date subdirectory exists
    const dateDir = join(getEntriesDir(baseDir), getDateDir(now))
    ensureDir(dateDir)

    const fullPath = join(dateDir, getEntryFilename(memory))
    const content = serializeMemory(memory)
    await writeFile(fullPath, content, "utf-8")

    return memory
  }

  async read(id: string): Promise<Memory | null> {
    await this.init()
    const all = await this.scanAllFiles()
    return all.find((m) => m.id === id) ?? null
  }

  async update(id: string, input: Partial<MemoryInput>): Promise<Memory | null> {
    const existing = await this.read(id)
    if (!existing) return null

    const now = new Date().toISOString()
    const updated: Memory = {
      ...existing,
      ...input,
      updated: now,
      tags: input.tags ?? existing.tags,
      supersedes: input.supersedes ?? existing.supersedes,
      sources: input.sources ?? existing.sources,
    }

    // Write updated file (same path)
    const baseDir = getScopeDir(this.projectDir, updated.scope)
    const dateDir = join(getEntriesDir(baseDir), getDateDir(updated.created))
    const filePath = join(dateDir, getEntryFilename(updated))
    const content = serializeMemory(updated)
    await writeFile(filePath, content, "utf-8")

    return updated
  }

  async archive(id: string): Promise<boolean> {
    const memory = await this.read(id)
    if (!memory) return false
    memory.status = "archived"
    memory.updated = new Date().toISOString()

    const baseDir = getScopeDir(this.projectDir, memory.scope)
    const dateDir = join(getEntriesDir(baseDir), getDateDir(memory.created))
    const filePath = join(dateDir, getEntryFilename(memory))
    const content = serializeMemory(memory)
    await writeFile(filePath, content, "utf-8")
    return true
  }

  async list(opts?: MemorySearchOptions): Promise<Memory[]> {
    let results = await this.scanAllFiles()

    if (opts) {
      results = results.filter((m) => matchesFilter(m, opts))
      results.sort(
        (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
      )
      if (opts.limit) {
        results = results.slice(0, opts.limit)
      }
    }

    return results
  }

  async search(opts: MemorySearchOptions): Promise<{ memory: Memory; score: number; snippet: string }[]> {
    const results = await this.list(opts)
    return results.map((memory) => ({
      memory,
      score: 1.0,
      snippet: memory.content.slice(0, 200),
    }))
  }

  async all(type?: string, scope?: MemoryScope): Promise<Memory[]> {
    return this.list({ type: type as any, scope })
  }

  async getActiveMemories(scope: MemoryScope, limit: number = 10): Promise<Memory[]> {
    return this.list({
      scope,
      status: "active",
      limit,
    })
  }

  async rebuildIndexMd(): Promise<string> {
    const active = await this.list({ status: "active" })
    const content = buildIndexMarkdown(active)

    // Write project index
    const projectBase = getScopeDir(this.projectDir, "project")
    const indexPath = getIndexFilePath(projectBase)
    await writeFile(indexPath, content, "utf-8")

    // Write global index
    const globalBase = getScopeDir(this.projectDir, "global")
    const globalIndexPath = getIndexFilePath(globalBase)
    await writeFile(globalIndexPath, content, "utf-8")

    return content
  }

  private async scanAllFiles(): Promise<Memory[]> {
    const results: Memory[] = []

    for (const scope of ["project", "global"] as MemoryScope[]) {
      const base = getScopeDir(this.projectDir, scope)
      const entriesDir = getEntriesDir(base)
      if (!existsSync(entriesDir)) continue

      await this.scanDir(entriesDir, results)
    }

    return results
  }

  private async scanDir(dir: string, results: Memory[]): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await this.scanDir(fullPath, results)
      } else if (entry.name.endsWith(".md") && !entry.name.startsWith("index")) {
        try {
          const content = await readFile(fullPath, "utf-8")
          const memory = parseMemoryFile(content, fullPath)
          if (memory) results.push(memory)
        } catch {
          // Skip unreadable files
        }
      }
    }
  }
}
