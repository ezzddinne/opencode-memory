export type MemoryType =
  | "fact"
  | "decision"
  | "preference"
  | "observation"
  | "convention"
  | "session-summary"

export const MEMORY_TYPES: readonly MemoryType[] = [
  "fact",
  "decision",
  "preference",
  "observation",
  "convention",
  "session-summary",
]

export type MemoryScope = "project" | "global"

export type MemoryStatus = "active" | "archived"

export interface Memory {
  id: string
  type: MemoryType
  scope: MemoryScope
  status: MemoryStatus
  title: string
  content: string
  tags: string[]
  created: string
  updated: string
  supersedes: string[]
  sources: string[]
}

export interface MemoryInput {
  type: MemoryType
  scope?: MemoryScope
  title: string
  content: string
  tags?: string[]
  supersedes?: string[]
  sources?: string[]
}

export interface MemorySearchOptions {
  query?: string
  type?: MemoryType
  scope?: MemoryScope
  status?: MemoryStatus
  tags?: string[]
  limit?: number
  offset?: number
}

export interface MemorySearchResult {
  memory: Memory
  score: number
  snippet: string
}

export interface MemoryStore {
  init(): Promise<void>
  write(input: MemoryInput): Promise<Memory>
  read(id: string): Promise<Memory | null>
  update(id: string, input: Partial<MemoryInput>): Promise<Memory | null>
  archive(id: string): Promise<boolean>
  list(opts?: MemorySearchOptions): Promise<Memory[]>
  search(opts: MemorySearchOptions): Promise<MemorySearchResult[]>
  all(type?: MemoryType, scope?: MemoryScope): Promise<Memory[]>
}

export interface PluginConfig {
  auto_extract: boolean
  max_injected_memories: number
  index_size_kb: number
  default_scope: MemoryScope
  extract_interval_turns: number
  memory_dir: string
  global_memory_dir: string
}
