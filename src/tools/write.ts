import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { MemoryStore } from "../types"

export function createWriteTool(store: MemoryStore): ToolDefinition {
  return tool({
    description: "Store a new persistent memory entry. Use this to save facts, decisions, preferences, observations, and conventions that should be remembered across sessions.",
    args: {
      type: tool.schema
        .enum(["fact", "decision", "preference", "observation", "convention", "session-summary"])
        .describe("The type of memory to store"),
      title: tool.schema.string().describe("A concise title for this memory"),
      content: tool.schema.string().describe("The detailed content of the memory"),
      scope: tool.schema
        .enum(["project", "global"])
        .optional()
        .default("project")
        .describe("Scope: 'project' for this project only, 'global' for all projects"),
      tags: tool.schema
        .string()
        .optional()
        .describe("Comma-separated tags for categorization"),
      supersedes: tool.schema
        .string()
        .optional()
        .describe("Comma-separated memory IDs that this memory supersedes"),
    },
    async execute(args) {
      const tags = args.tags
        ? args.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : []
      const supersedes = args.supersedes
        ? args.supersedes.split(",").map((t) => t.trim()).filter(Boolean)
        : []

      const memory = await store.write({
        type: args.type,
        title: args.title,
        content: args.content,
        scope: args.scope ?? "project",
        tags,
        supersedes,
      })

      return JSON.stringify({
        id: memory.id,
        type: memory.type,
        title: memory.title,
        scope: memory.scope,
        tags: memory.tags,
        created: memory.created,
      })
    },
  })
}
