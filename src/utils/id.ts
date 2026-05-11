import { randomUUID } from "node:crypto"

export function generateId(): string {
  return randomUUID().split("-").slice(0, 2).join("")
}

export function generateMemoryId(type: string): string {
  const short = generateId()
  return `mem-${short}`
}

export function generateSessionId(): string {
  return `session-${generateId()}`
}
