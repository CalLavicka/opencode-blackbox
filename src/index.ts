import type { Plugin } from '@opencode-ai/plugin'
import { redactOutput } from './redact'
import { matchesAny, normalize, parseAllowed, shouldBlackbox } from './blackbox-utils'

type AgentInfo = {
  name: string
  options: Record<string, unknown>
}

const allowedExtensions = ['ts', 'tsx', 'js', 'jsx']

const plugin: Plugin = async (ctx) => {
  const allowCache = new Map<string, ReturnType<typeof parseAllowed>>()
  const written = new Map<string, Set<string>>()

  const log = async (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    extra?: Record<string, unknown>,
  ) => {
    try {
      await ctx.client.app.log({
        body: {
          service: 'opencode-blackbox',
          level,
          message,
          extra,
        },
      })
    } catch (error) {
      console.error('opencode-blackbox log failed', error)
    }
  }

  void log('info', 'Plugin initialized')

  const agentsPromise = ctx.client.app
    .agents({ query: { directory: ctx.directory } })
    .then((result) => {
      const agents = new Map<string, AgentInfo>()
      for (const item of result.data ?? []) {
        agents.set(item.name, { name: item.name, options: item.options })
      }
      return agents
    })

  const sessionToAgent = new Map<string, string>()

  return {
    'chat.message': async (input, _output) => {
      const agent = input.agent
      if (agent == null) return
      sessionToAgent.set(input.sessionID, agent)
    },
    'tool.execute.after': async (input, output) => {
      if (input.tool === 'write') {
        const filepath = output.metadata.filepath
        if (typeof filepath !== 'string') return
        const files = written.get(input.sessionID) ?? new Set<string>()
        files.add(normalize(filepath))
        written.set(input.sessionID, files)
        return
      }

      if (input.tool !== 'read') return

      const ext = output.title.split('.').pop()!.toLowerCase()
      if (!allowedExtensions.includes(ext)) return

      const agentName = sessionToAgent.get(input.sessionID)
      if (agentName == null) return

      const agent = (await agentsPromise).get(agentName)
      if (!shouldBlackbox(agent)) return

      const filePath = normalize(output.title)
      const seen = written.get(input.sessionID)
      if (seen?.has(filePath)) return

      const allow = allowCache.get(agentName) ?? parseAllowed(agent)
      allowCache.set(agentName, allow)
      if (matchesAny(filePath, allow)) return

      const updated = await redactOutput(output.title, output.output)
      if (!updated) return

      output.output = `${updated}\n\n<system-reminder>\nImplementation redacted by opencode-blackbox; signatures and structure are intact.\n</system-reminder>`
      output.metadata = {
        ...(output.metadata ?? {}),
        redacted: true,
        redaction: {
          policy: 'blackbox',
          placeholder: 'implementation hidden',
        },
      }
      void log('info', 'Redacted tool output', {
        filePath,
        agent: agentName,
      })
    },
  }
}

export default plugin
