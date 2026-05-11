import type { Memory, MemoryInput, MemoryType, MemoryScope, MemoryStatus } from "../types"

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

export function parseMemoryFile(content: string, filePath: string): Memory | null {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null

  const frontmatter = parseFrontmatter(match[1])
  const body = match[2].trim()

  const id = frontmatter.id
  if (!id) return null

  return {
    id,
    type: (frontmatter.type as MemoryType) ?? "observation",
    scope: (frontmatter.scope as MemoryScope) ?? "project",
    status: (frontmatter.status as MemoryStatus) ?? "active",
    title: frontmatter.title ?? "Untitled",
    content: body,
    tags: parseArray(frontmatter.tags),
    created: frontmatter.created ?? new Date().toISOString(),
    updated: frontmatter.updated ?? frontmatter.created ?? new Date().toISOString(),
    supersedes: parseArray(frontmatter.supersedes),
    sources: parseArray(frontmatter.sources),
  }
}

export function serializeMemory(memory: Memory): string {
  const frontmatter = serializeFrontmatter({
    id: memory.id,
    type: memory.type,
    created: memory.created,
    updated: memory.updated,
    scope: memory.scope,
    status: memory.status,
    tags: memory.tags.length ? memory.tags.join(", ") : undefined,
    supersedes: memory.supersedes.length ? memory.supersedes.join(", ") : undefined,
    sources: memory.sources.length ? memory.sources.join(", ") : undefined,
    title: memory.title,
  })

  return `---\n${frontmatter}---\n\n${memory.content}\n`
}

function parseFrontmatter(raw: string): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const line of raw.split("\n")) {
    const colonIdx = line.indexOf(": ")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 2).trim()
    result[key] = value
  }
  return result
}

function serializeFrontmatter(fields: Record<string, string | undefined>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      lines.push(`${key}: ${value}`)
    }
  }
  return lines.join("\n") + "\n"
}

function parseArray(value: string | undefined): string[] {
  if (!value) return []
  return value.split(",").map((s) => s.trim()).filter(Boolean)
}

export function formatMemoryDate(dateStr: string): string {
  const d = new Date(dateStr)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${yyyy}-${mm}-${dd}`
}

export function getEntryFilename(memory: Memory): string {
  const date = formatMemoryDate(memory.created)
  const slug = memory.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return `${date}_${memory.type}_${slug}.md`
}

export function getDateDir(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function buildIndexMarkdown(memories: Memory[]): string {
  const parts: string[] = ["# Memory Index\n"]

  if (memories.length === 0) {
    parts.push("_No memories stored yet._\n")
    return parts.join("\n")
  }

  const byType: Record<string, Memory[]> = {}
  for (const m of memories) {
    if (m.status !== "active") continue
    ;(byType[m.type] ??= []).push(m)
  }

  const typeLabels: Record<string, string> = {
    fact: "Facts",
    decision: "Decisions",
    preference: "Preferences",
    observation: "Observations",
    convention: "Conventions",
    "session-summary": "Session Summaries",
  }

  for (const [type, entries] of Object.entries(byType)) {
    const label = typeLabels[type] ?? type
    parts.push(`## ${label}`)
    for (const m of entries.slice(0, 20)) {
      const date = formatMemoryDate(m.created)
      parts.push(`- [${m.title}](${getEntryFilename(m)}) — ${date}`)
    }
    if (entries.length > 20) {
      parts.push(`- _... and ${entries.length - 20} more_`)
    }
    parts.push("")
  }

  const total = Object.values(byType).reduce((s, a) => s + a.length, 0)
  parts.push(`---\n_${total} total active memories_`)

  return parts.join("\n")
}
