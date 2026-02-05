import type { Plugin } from '@opencode-ai/plugin'
import path from 'path'
import { redactFile, redactOutput } from './redact'
import { matchesAny, normalize, parseAllowed, shouldBlackbox } from './blackbox-utils'

type AgentInfo = {
  name: string
  options: Record<string, unknown>
}

type FilePart = {
  type: 'file'
  mime: string
  url: string
  filename?: string
  source?: {
    type: 'file' | 'symbol' | 'resource'
    path?: string
    uri?: string
  }
}

type TextPart = {
  type: 'text'
  text: string
  metadata?: Record<string, unknown>
}

const allowedExtensions = ['ts', 'tsx', 'js', 'jsx']

const isFilePart = (part: { type: string }): part is FilePart => part.type === 'file'
const isTextPart = (part: { type: string }): part is TextPart => part.type === 'text'

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
    'chat.message': async (input) => {
      const agent = input.agent
      if (agent == null) return
      sessionToAgent.set(input.sessionID, agent)
    },
    'experimental.chat.messages.transform': async (_input, output) => {
      const userMessage = output.messages.find((message) => message.info.role === 'user')
      if (!userMessage) return

      const agentName = userMessage.info.role === 'user' ? userMessage.info.agent : undefined
      if (!agentName) return

      const agent = (await agentsPromise).get(agentName)
      if (!shouldBlackbox(agent)) return

      const allow = allowCache.get(agentName) ?? parseAllowed(agent)
      allowCache.set(agentName, allow)

      const basePath = ctx.worktree ?? ctx.directory
      let didRedact = false

      for (const message of output.messages) {
        const parts = message.parts
        for (let index = 0; index < parts.length; index += 1) {
          const part = parts[index]
          if (!part) continue
          if (isFilePart(part)) {
            const filePart = part
            if (!filePart.filename) continue
            const ext = filePart.filename.split('.').pop()?.toLowerCase()
            if (!ext || !allowedExtensions.includes(ext)) continue

            const sourcePath = filePart.source?.type === 'file' ? filePart.source.path : undefined
            const filePath = sourcePath ?? filePart.filename
            const normalizedPath = normalize(
              path.isAbsolute(filePath) ? path.relative(basePath, filePath) : filePath,
            )
            if (matchesAny(normalizedPath, allow)) continue

            const absolutePath = path.isAbsolute(filePath)
              ? filePath
              : path.resolve(basePath, filePath)

            try {
              const original = await Bun.file(absolutePath).text()
              const redacted = redactFile(absolutePath, original)
              filePart.url = `data:${filePart.mime};base64,${Buffer.from(redacted).toString('base64')}`
              didRedact = true
              void log('info', 'Redacted file attachment', {
                filePath: normalizedPath,
                agent: agentName,
              })
            } catch (error) {
              void log('warn', 'Failed to redact file part', {
                filePath: normalizedPath,
                agent: agentName,
                error: error instanceof Error ? error.message : String(error),
              })
              continue
            }
          }

          if (!isTextPart(part)) continue
          const textPart = part
          const prefix = 'Called the Read tool with the following input: '
          if (!textPart.text.startsWith(prefix)) continue

          const payload = textPart.text.slice(prefix.length)
          let readInput: { filePath?: string } | undefined
          try {
            readInput = JSON.parse(payload)
          } catch {
            continue
          }

          const rawPath = readInput?.filePath
          if (!rawPath) continue
          const ext = rawPath.split('.').pop()?.toLowerCase()
          if (!ext || !allowedExtensions.includes(ext)) continue

          const normalizedPath = normalize(
            path.isAbsolute(rawPath) ? path.relative(basePath, rawPath) : rawPath,
          )
          if (matchesAny(normalizedPath, allow)) continue

          const next = parts[index + 1]
          if (!next || !isTextPart(next)) continue

          const outputText = next.text
          if (!outputText.includes('<file>')) continue

          const absolutePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(basePath, rawPath)

          const updated = await redactOutput(absolutePath, outputText)
          if (!updated) continue

          next.text = `${updated}\n\n<system-reminder>\nImplementation redacted by opencode-blackbox; signatures and structure are intact.\n</system-reminder>`
          next.metadata = {
            ...next.metadata,
            redacted: true,
          }
          didRedact = true
          void log('info', 'Redacted inline read output', {
            filePath: normalizedPath,
            agent: agentName,
          })
        }

        if (!didRedact) continue
        if (message.parts.some((p) => isTextPart(p) && p.metadata?.redaction)) continue
        const firstText = message.parts.find((p) => isTextPart(p))
        if (!firstText) continue
        firstText.text = `${firstText.text}\n\n<system-reminder>\nSome attached files were redacted by opencode-blackbox.\n</system-reminder>`
        firstText.metadata = {
          ...firstText.metadata,
          redaction: true,
        }
      }
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
        ...output.metadata,
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
