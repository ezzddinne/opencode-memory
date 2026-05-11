import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { MemoryStore } from "../types"

export function createSearchTool(store: MemoryStore): ToolDefinition {
  return tool({
    description: "Search stored memories by keyword, type, or tags. Returns matching memories ranked by relevance with content snippets.",
    args: {
      query: tool.schema
        .string()
        .optional()
        .default("")
        .describe("Search keywords to find relevant memories"),
      type: tool.schema
        .enum(["fact", "decision", "preference", "observation", "convention", "session-summary"])
        .optional()
        .describe("Filter by memory type"),
      scope: tool.schema
        .enum(["project", "global"])
        .optional()
        .describe("Filter by scope: 'project' or 'global'"),
      tags: tool.schema
        .string()
        .optional()
        .describe("Comma-separated tags to filter by"),
      limit: tool.schema
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of results to return (default: 10)"),
    },
    async execute(args) {
      const tags = args.tags
        ? args.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined

      const results = await store.search({
        query: args.query,
        type: args.type,
        scope: args.scope,
        tags,
        limit: args.limit,
      })

      if (results.length === 0) {
        return "No memories found matching the search criteria."
      }

      const lines = results.map((r, i) => {
        const tagStr = r.memory.tags.length ? ` [${r.memory.tags.join(", ")}]` : ""
        const statusStr = r.memory.status === "archived" ? " (archived)" : ""
        return `${i + 1}. **${r.memory.title}** (${r.memory.type}, score: ${r.score.toFixed(2)})${tagStr}${statusStr}\n   ID: \`${r.memory.id}\`\n   ${r.snippet}`
      })

      return `Found ${results.length} memories:\n\n${lines.join("\n\n")}`
    },
  })
}
