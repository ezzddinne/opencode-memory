import type { Plugin } from "@opencode-ai/plugin"
import { FileMemoryStore } from "./memory-store"
import { FtsMemoryIndex } from "./memory-index"
import { resolveConfig } from "./config"
import { createWriteTool } from "./tools/write"
import { createReadTool } from "./tools/read"
import { createSearchTool } from "./tools/search"
import { createForgetTool } from "./tools/forget"
import { createListTool } from "./tools/list"
import { createSystemTransformHook } from "./hooks/system-transform"
import { createAutoExtractHook } from "./hooks/auto-extract"
import { createCompactionHook } from "./hooks/compaction"

export const server: Plugin = async (input, options) => {
  const projectDir = input.directory
  const config = resolveConfig(options)

  const store = new FileMemoryStore(projectDir)
  const index = new FtsMemoryIndex(projectDir)

  await store.init()
  index.init()

  // Sync existing entries into FTS index
  const allMemories = await store.list({ status: "active" })
  for (const memory of allMemories) {
    index.index(memory)
  }

  return {
    tool: {
      memory_write: createWriteTool(store),
      memory_read: createReadTool(store),
      memory_search: createSearchTool(store),
      memory_forget: createForgetTool(store),
      memory_list: createListTool(store),
    },

    event: createAutoExtractHook(store, config),

    "experimental.chat.system.transform": createSystemTransformHook(store, config, projectDir),

    "experimental.session.compacting": createCompactionHook(store, config),
  }
}

export default server
