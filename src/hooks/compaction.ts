import type { MemoryStore, PluginConfig } from "../types"

export function createCompactionHook(store: MemoryStore, config: PluginConfig) {
  return async (
    _input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ): Promise<void> => {
    try {
      const memories = await store.list({
        status: "active",
        limit: config.max_injected_memories,
      })

      if (memories.length === 0) return

      const lines = memories.map((m) => {
        const date = m.created.slice(0, 10)
        return `- [${date}] [${m.type}] ${m.title}`
      })

      output.context.push(
        `Key memories:\n${lines.join("\n")}`,
      )
    } catch {
      // Don't let a compaction hook failure crash the session
    }
  }
}
