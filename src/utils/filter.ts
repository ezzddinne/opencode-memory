import type { Memory, MemorySearchOptions, MemoryType, MemoryScope, MemoryStatus } from "../types"

export function matchesFilter(memory: Memory, opts: MemorySearchOptions): boolean {
  if (opts.type && memory.type !== opts.type) return false
  if (opts.scope && memory.scope !== opts.scope) return false
  if (opts.status && memory.status !== opts.status) return false
  if (opts.tags && opts.tags.length > 0) {
    const hasTag = opts.tags.some((t) => memory.tags.includes(t))
    if (!hasTag) return false
  }
  return true
}

export function computeSnippet(text: string, query: string, maxLen: number = 150): string {
  if (!query) return text.slice(0, maxLen).trim()

  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)

  if (idx === -1) return text.slice(0, maxLen).trim()

  const start = Math.max(0, idx - Math.floor((maxLen - qLower.length) / 2))
  const end = Math.min(text.length, start + maxLen)

  let snippet = text.slice(start, end).trim()
  if (start > 0) snippet = `...${snippet}`
  if (end < text.length) snippet = `${snippet}...`

  return snippet
}

export function tagSearchScore(tags: string[], queryTags: string[]): number {
  if (!queryTags.length) return 0
  const matched = queryTags.filter((t) => tags.includes(t)).length
  return matched / queryTags.length
}
