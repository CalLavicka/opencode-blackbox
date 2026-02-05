import path from 'path'
import { Glob } from 'bun'

type AgentInfo = {
  name: string
  options: Record<string, unknown>
}

export function shouldBlackbox(agent: AgentInfo | undefined) {
  if (!agent) return false
  return agent.options?.['blackbox'] === true
}

export function parseAllowed(agent: AgentInfo | undefined) {
  const defaults = ['**/*.test.{ts,tsx}', '**/tests/**']
  const fromAgent = parseAgentAllowlist(agent)
  const merged = [...fromAgent, ...defaults]
  return merged.map((pattern) => new Glob(pattern))
}

export function matchesAny(filePath: string, globs: Glob[]) {
  return globs.some((glob) => glob.match(filePath))
}

export function normalize(filePath: string) {
  return path.normalize(filePath)
}

function parseAgentAllowlist(agent: AgentInfo | undefined) {
  const raw = agent?.options?.['blackboxAllow']
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((value) => `${value}`.trim()).filter((value) => value.length > 0)
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  }
  return []
}
