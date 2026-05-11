import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { MemoryStore } from "../types"

export function createListTool(store: MemoryStore): ToolDefinition {
  return tool({
    description: "List recent memory entries grouped by type. Shows active memories with their IDs, titles, and creation dates.",
    args: {
      type: tool.schema
        .enum(["fact", "decision", "preference", "observation", "convention", "session-summary"])
        .optional()
        .describe("Filter by memory type"),
      scope: tool.schema
        .enum(["project", "global"])
        .optional()
        .describe("Filter by scope: 'project' or 'global'"),
      limit: tool.schema
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of memories to return (default: 20)"),
      include_archived: tool.schema
        .boolean()
        .optional()
        .default(false)
        .describe("Include archived memories"),
    },
    async execute(args) {
      const memories = await store.list({
        type: args.type,
        scope: args.scope,
        status: args.include_archived ? undefined : "active",
        limit: args.limit,
      })

      if (memories.length === 0) {
        return "No memories found."
      }

      const byType: Record<string, typeof memories> = {}
      for (const m of memories) {
        const key = m.type
        ;(byType[key] ??= []).push(m)
      }

      const parts: string[] = [`Found ${memories.length} memories:`]
      for (const [type, entries] of Object.entries(byType)) {
        parts.push(`\n## ${type.charAt(0).toUpperCase() + type.slice(1)}s`)
        for (const m of entries) {
          const date = m.created.slice(0, 10)
          const tagStr = m.tags.length ? ` [${m.tags.join(", ")}]` : ""
          const statusStr = m.status === "archived" ? " (archived)" : ""
          parts.push(`- \`${m.id}\` **${m.title}** — ${date}${tagStr}${statusStr}`)
        }
      }

      return parts.join("\n")
    },
  })
}
