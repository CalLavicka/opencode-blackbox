import { describe, expect, test } from 'bun:test'
import path from 'path'
import { readFile } from 'fs/promises'
import { hiddenInline, hiddenLine, redactFile } from '../src/redact'

const fixture = path.join(import.meta.dir, 'fixtures', 'input.ts')

describe('redactFile', () => {
  test('preserves line count and hides implementations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const redacted = redactFile(fixture, input)

    const inputLines = input.split('\n')
    const outputLines = redacted.split('\n')

    expect(outputLines.length).toBe(inputLines.length)
    expect(redacted).toContain('File level doc comment')
    expect(redacted).toContain('Adds numbers together')
    expect(redacted).toContain(hiddenLine)
    expect(redacted).toContain(hiddenInline)
    expect(redacted).not.toContain('return a + b')
  })

  test('redacts property initializers', async () => {
    const input = await readFile(fixture, 'utf-8')
    const redacted = redactFile(fixture, input)

    expect(redacted).toContain(`= ${hiddenInline}`)
    expect(redacted).toContain('private value: number')
  })

  test('hides non-exported helpers entirely', async () => {
    const input = await readFile(fixture, 'utf-8')
    const redacted = redactFile(fixture, input)

    expect(redacted).not.toContain('function helperSecret')
    expect(redacted).not.toContain('const hiddenValue = 42')
    expect(redacted).toContain(hiddenLine)
  })
})
