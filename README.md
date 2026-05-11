# @opencode-ai/memory

[![CI](https://github.com/ezzddinne/opencode-memory/actions/workflows/ci.yml/badge.svg)](https://github.com/ezzddinne/opencode-memory/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/ezzddinne/opencode-memory)](https://github.com/ezzddinne/opencode-memory/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ezzddinne/opencode-memory?style=social)](https://github.com/ezzddinne/opencode-memory)

> Persistent memory system for OpenCode AI coding agents — long-term context retention across sessions.

## Overview

OpenCode starts every session from scratch — no memory of past decisions, established patterns, or project context. This plugin fixes that.

Memories are stored as plain markdown files in `.opencode/memory/` (human-readable, git-versionable, zero lock-in) with an optional SQLite FTS5 index for fast keyword search. **No external databases, no API keys, no Docker.**

## Features

- **5 tools** — `memory_write`, `memory_read`, `memory_search`, `memory_forget`, `memory_list`
- **Auto-injection** — Relevant memories silently injected into every session's system prompt as a `[MEMORY]` block
- **Auto-extraction** — Key facts and errors automatically saved during sessions (configurable)
- **Dual scopes** — Per-project memory (`.opencode/memory/`) + global user memory (`~/.config/opencode/memory/`)
- **6 memory types** — `fact`, `decision`, `preference`, `observation`, `convention`, `session-summary`
- **Compaction-proof** — Memory lives in the system prompt, never lost to context truncation
- **Full-text search** — SQLite FTS5 keyword search with BM25 ranking (graceful fallback without Bun:SQLite)
- **Markdown storage** — Every memory is a readable, git-versionable markdown file with YAML frontmatter
- **Zero dependencies** — No external services, no native modules, no API keys required

## Installation

### Prerequisites

- [OpenCode](https://opencode.ai) >= 1.0.0

### Quick install (recommended)

```bash
opencode plugin add @opencode-ai/memory
```

Or via npm:

```bash
npm install @opencode-ai/memory
```

### Manual install

Add to your `opencode.json` (`~/.config/opencode/opencode.jsonc` or `.opencode/opencode.jsonc`):

```jsonc
{
  "plugin": ["@opencode-ai/memory"]
}
```

### Install from GitHub

```bash
opencode plugin add https://github.com/ezzddinne/opencode-memory
```

### Install from local path (development)

```bash
git clone https://github.com/ezzddinne/opencode-memory.git
```

Then in your config:

```jsonc
{
  "plugin": ["file:///absolute/path/to/opencode-memory"]
}
```

## Configuration

All options are optional with sensible defaults:

```jsonc
{
  "plugin": [["@opencode-ai/memory", {
    "auto_extract": true,            // Auto-save observations and heartbeats
    "max_injected_memories": 5,      // Max memories in system prompt [MEMORY] block
    "index_size_kb": 25,            // Max size of auto-generated index file
    "default_scope": "project",      // Default scope for new memories
    "extract_interval_turns": 5     // Auto-extract heartbeat every N turns
  }]]
}
```

## Usage

Once installed, the plugin works automatically. No commands needed.

### Tools

| Tool | Description |
|------|-------------|
| `memory_write` | Store a new memory (type, title, content, scope, tags) |
| `memory_read` | Read a specific memory by ID |
| `memory_search` | Keyword search with filters (type, scope, tags) |
| `memory_forget` | Archive a memory (soft-delete) |
| `memory_list` | List recent memories grouped by type |

### Memory Types

| Type | Purpose | Example |
|------|---------|---------|
| `fact` | Immutable project facts | "Uses PostgreSQL, Prisma ORM" |
| `decision` | Architectural choices | "Chose tRPC over REST for type safety" |
| `preference` | User preferences | "Prefer tabs over spaces" |
| `observation` | Debugging insights | "Build fails when node_modules is stale" |
| `convention` | Coding conventions | "Use PascalCase for types" |
| `session-summary` | Auto-generated session summaries | "Implemented auth middleware" |

### Scopes

- **`project`** — Stored in `.opencode/memory/`, scoped to the current project
- **`global`** — Stored in `~/.config/opencode/memory/`, shared across all projects

### Recommended AGENTS.md

Add this to your `~/.config/opencode/AGENTS.md` for optimal behavior:

```markdown
# Memory System

You have a persistent memory system that retains context across sessions.

## How it works

- A `[MEMORY]` block is injected into your system prompt on every turn. Read it — it contains active conventions, decisions, and relevant context.
- After every few turns, key observations are auto-saved.
- You can explicitly save memories using the `memory_write` tool.

## Rules

- **Read and use the `[MEMORY]` block** — treat it as ground truth for project state.
- **Use `memory_write`** when you learn something important (architecture decision, debugging insight, user preference).
- **Use `memory_search`** when you need to recall past context.
- **Never announce** that you are saving or loading memory.
- **Never ask the user** to manage memory — it is fully automatic.
```

## Storage Layout

```
.opencode/memory/
├── index.md              # Auto-generated table of contents
├── memory.db             # SQLite FTS5 index (optional, Bun-only)
├── entries/
│   └── YYYY-MM/
│       └── YYYY-MM-DD_<type>_<slug>.md
└── sessions/
    └── YYYY-MM-DD.md
```

Each entry is a markdown file with YAML frontmatter:

```markdown
---
id: mem-abc123
type: decision
created: 2026-05-11T10:30:00Z
updated: 2026-05-11T10:30:00Z
scope: project
status: active
tags: database, postgresql
supersedes: []
sources: [session-xyz]
---
# Database Choice: PostgreSQL

Decided to use PostgreSQL over MySQL for:
- Better JSONB support
- Superior concurrency handling
- Team familiarity
```

## Development

```bash
git clone <repo>
cd opencode-memory
npm install
npm run build    # Compile TypeScript
npm run typecheck  # Type-check without emitting
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 OpenCode Session                 │
├─────────────────────────────────────────────────┤
│  Plugin: @opencode-ai/memory                     │
│                                                  │
│  ┌──────────┐   ┌──────────┐   ┌─────────────┐  │
│  │  Tools   │   │  Hooks   │   │   Memory     │  │
│  │          │   │          │   │   Store      │  │
│  │ write    │   │ system   │   │              │  │
│  │ read     │──▶│ transform├──▶│  Markdown    │  │
│  │ search   │   │          │   │  files       │  │
│  │ forget   │   │ event    │   │  (.opencode/ │  │
│  │ list     │   │          │   │   memory/)   │  │
│  └──────────┘   │ compact  │   │              │  │
│                 └──────────┘   │  SQLite FTS5 │  │
│                                │  index       │  │
│                                └──────────────┘  │
└─────────────────────────────────────────────────┘
```

### Hooks

| Hook | Purpose |
|------|---------|
| `experimental.chat.system.transform` | Injects `[MEMORY]` block with relevant active memories |
| `event` | Monitors for turn completion and tool errors to auto-extract |
| `experimental.session.compacting` | Appends key memories to compaction context |

## Roadmap

### v1 (current)
- [x] Markdown file storage
- [x] FTS5 keyword search
- [x] 5 custom tools
- [x] Auto-extraction (basic)
- [x] System prompt injection
- [x] Project + Global scopes
- [x] Compaction hook

### v2 (planned)
- [ ] Semantic search via local embeddings (Transformers.js or Voyage AI)
- [ ] LLM-powered extraction (via OpenCode provider)
- [ ] Web dashboard for browsing/editing memories
- [ ] MCP server for cross-tool compatibility

## License

MIT
