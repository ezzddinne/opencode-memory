import { join } from "node:path"
import { homedir } from "node:os"
import { existsSync, mkdirSync } from "node:fs"
import type { MemoryScope } from "../types"

export function getProjectMemoryDir(projectDir: string): string {
  return join(projectDir, ".opencode", "memory")
}

export function getGlobalMemoryDir(): string {
  return join(homedir(), ".config", "opencode", "memory")
}

export function getScopeDir(projectDir: string | undefined, scope: MemoryScope): string {
  return scope === "global" ? getGlobalMemoryDir() : getProjectMemoryDir(projectDir ?? ".")
}

export function getEntriesDir(baseDir: string): string {
  return join(baseDir, "entries")
}

export function getSessionsDir(baseDir: string): string {
  return join(baseDir, "sessions")
}

export function getIndexFilePath(baseDir: string): string {
  return join(baseDir, "index.md")
}

export function getDbPath(baseDir: string): string {
  return join(baseDir, "memory.db")
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
