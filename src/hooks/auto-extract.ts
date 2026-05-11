import type { MemoryStore, PluginConfig } from "../types"

export function createAutoExtractHook(store: MemoryStore, config: PluginConfig) {
  let turnCount = 0

  return async (input: { event: any }): Promise<void> => {
    if (!config.auto_extract) return
    const event = input.event

    // Track turn count from message events
    if (event.type === "message" && event.role === "assistant") {
      turnCount++
    }

    // Every N turns, save a session heartbeat observation
    if (turnCount > 0 && turnCount % config.extract_interval_turns === 0) {
      turnCount = 0
      await saveHeartbeat(store)
    }

    // Track tool errors for auto-observation
    if (event.type === "tool.error" || (event.type === "tool.execute.after" && event.error)) {
      await saveErrorObservation(store, event)
    }
  }
}

async function saveHeartbeat(store: MemoryStore): Promise<void> {
  try {
    const now = new Date()
    const recent = await store.list({ status: "active", limit: 3 })
    const recentTitles = recent.map((m) => m.title).join(", ")

    await store.write({
      type: "observation",
      scope: "project",
      title: `Session activity at ${now.toISOString().slice(0, 16)}`,
      content: `Auto-saved checkpoint. Recent context includes: ${recentTitles || "none"}.`,
      tags: ["auto", "heartbeat"],
    })
  } catch {
    // Silently fail for auto-extraction
  }
}

async function saveErrorObservation(store: MemoryStore, event: any): Promise<void> {
  try {
    const toolName = event.tool ?? event.callID ?? "unknown"
    const errorMsg = typeof event.error === "string" ? event.error : event.error?.message ?? "Unknown error"

    await store.write({
      type: "observation",
      scope: "project",
      title: `Error in tool: ${toolName}`,
      content: `Tool "${toolName}" encountered an error: ${errorMsg}`,
      tags: ["auto", "error"],
    })
  } catch {
    // Silently fail for auto-extraction
  }
}
