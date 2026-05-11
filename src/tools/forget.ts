import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { MemoryStore } from "../types"

export function createForgetTool(store: MemoryStore): ToolDefinition {
  return tool({
    description: "Archive (soft-delete) a memory entry by its ID. The memory is marked as 'archived' and will no longer appear in normal searches or be injected into context.",
    args: {
      id: tool.schema.string().describe("The ID of the memory to archive (e.g. 'mem-abc123')"),
    },
    async execute(args) {
      const success = await store.archive(args.id)
      if (success) {
        return `Memory "${args.id}" has been archived. It will no longer appear in searches or context injection.`
      }
      return `No active memory found with ID "${args.id}".`
    },
  })
}
