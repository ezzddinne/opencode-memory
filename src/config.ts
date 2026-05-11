import type { PluginOptions } from "@opencode-ai/plugin"
import type { PluginConfig, MemoryScope } from "./types"

const DEFAULTS: PluginConfig = {
  auto_extract: true,
  max_injected_memories: 5,
  index_size_kb: 25,
  default_scope: "project" as MemoryScope,
  extract_interval_turns: 5,
  memory_dir: "",
  global_memory_dir: "",
}

export function resolveConfig(options?: PluginOptions): PluginConfig {
  if (!options || typeof options !== "object") {
    return { ...DEFAULTS }
  }

  const opts = options as Record<string, unknown>

  return {
    auto_extract: typeof opts.auto_extract === "boolean" ? opts.auto_extract : DEFAULTS.auto_extract,
    max_injected_memories:
      typeof opts.max_injected_memories === "number"
        ? Math.max(1, Math.min(50, opts.max_injected_memories))
        : DEFAULTS.max_injected_memories,
    index_size_kb:
      typeof opts.index_size_kb === "number"
        ? Math.max(5, Math.min(500, opts.index_size_kb))
        : DEFAULTS.index_size_kb,
    default_scope:
      opts.default_scope === "project" || opts.default_scope === "global"
        ? opts.default_scope
        : DEFAULTS.default_scope,
    extract_interval_turns:
      typeof opts.extract_interval_turns === "number"
        ? Math.max(1, Math.min(100, opts.extract_interval_turns))
        : DEFAULTS.extract_interval_turns,
    memory_dir: typeof opts.memory_dir === "string" ? opts.memory_dir : DEFAULTS.memory_dir,
    global_memory_dir: typeof opts.global_memory_dir === "string" ? opts.global_memory_dir : DEFAULTS.global_memory_dir,
  }
}
