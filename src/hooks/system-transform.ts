import type { MemoryStore, PluginConfig, Memory, MemoryScope } from "../types"

export function createSystemTransformHook(store: MemoryStore, config: PluginConfig, projectDir: string) {
  return async (
    _input: { sessionID?: string; model: any },
    output: { system: string[] },
  ): Promise<void> => {
    try {
      const block = await buildMemoryBlock(store, config, projectDir)
      if (block) {
        output.system.push(block)
      }
    } catch {
      // Don't let a memory injection failure crash the session
    }
  }
}

async function buildMemoryBlock(store: MemoryStore, config: PluginConfig, projectDir: string): Promise<string | null> {
  const [projectMemories, globalMemories] = await Promise.all([
    store.list({ scope: "project", status: "active", limit: config.max_injected_memories }),
    store.list({ scope: "global", status: "active", limit: config.max_injected_memories }),
  ])

  const allMemories = [...projectMemories, ...globalMemories]
  if (allMemories.length === 0) return null

  const parts: string[] = ["[MEMORY]"]

  const byType = groupByType(allMemories)
  const typeOrder: string[] = ["convention", "decision", "fact", "preference", "observation", "session-summary"]
  const typeLabels: Record<string, string> = {
    convention: "Conventions",
    decision: "Decisions",
    fact: "Facts",
    preference: "Preferences",
    observation: "Observations",
    "session-summary": "Session History",
  }

  for (const type of typeOrder) {
    const entries = byType[type]
    if (!entries || entries.length === 0) continue
    const label = typeLabels[type] ?? type
    parts.push(`\n### ${label}`)
    for (const m of entries) {
      const date = m.created.slice(0, 10)
      parts.push(`- [${date}] ${m.title}`)
      if (m.content.length < 120) {
        parts.push(`  ${m.content}`)
      }
    }
  }

  parts.push("\n[/MEMORY]")
  return parts.join("\n")
}

function groupByType(memories: Memory[]): Record<string, Memory[]> {
  const groups: Record<string, Memory[]> = {}
  for (const m of memories) {
    ;(groups[m.type] ??= []).push(m)
  }
  return groups
}
