import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { MemoryStore } from "../types"

export function createReadTool(store: MemoryStore): ToolDefinition {
  return tool({
    description: "Read a specific memory entry by its ID. Returns the full memory content including title, type, tags, and body.",
    args: {
      id: tool.schema.string().describe("The ID of the memory to read (e.g. 'mem-abc123')"),
    },
    async execute(args) {
      const memory = await store.read(args.id)
      if (!memory) {
        return `No memory found with ID "${args.id}".`
      }
      return JSON.stringify(memory, null, 2)
    },
  })
}
