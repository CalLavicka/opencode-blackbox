import { describe, expect, test } from 'bun:test'
import path from 'path'
import { readFile } from 'fs/promises'
import { hiddenInline, hiddenLine, redactFile, redactOutput } from '../src/redact'

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

  test('partial redaction with window parameter', async () => {
    const input = await readFile(fixture, 'utf-8')
    // Window covers lines 18-26 (1-indexed), which includes the add and keepSignature functions
    const redacted = redactFile(fixture, input, { start: 18, end: 26 })

    const lines = redacted.split('\n')

    // Lines outside the window should be unchanged
    expect(lines[0]).toBe('/**')
    expect(lines[1]).toBe(' * File level doc comment.')

    // Lines inside the window should be redacted
    // Line 18 (index 17) is 'export function add...'
    expect(lines[17]).toBe('export function add(a: number, b: number): number {')
    // Line 19 (index 18) should be redacted
    expect(lines[18]).toContain(hiddenLine)
    // Line 20 (index 19) was 'return a + b' - should be empty after redaction
    expect(lines[19]).toBe('')
  })
})

describe('redactOutput', () => {
  test('redacts file content in tool output', async () => {
    const output = `<file>
00018| export function add(a: number, b: number): number {
00019|   // inline comment should be removed
00020|   return a + b
00021| }
</file>`

    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()
    expect(result).toContain('export function add(a: number, b: number): number {')
    expect(result).toContain(hiddenLine)
    expect(result).not.toContain('return a + b')
    expect(result).not.toContain('inline comment should be removed')
  })

  test('returns undefined for non-file output', async () => {
    const output = 'some random text without file tags'
    const result = await redactOutput(fixture, output)
    expect(result).toBeUndefined()
  })

  test('returns undefined for non-existent file', async () => {
    const output = `<file>
00001| some content
</file>`
    const result = await redactOutput('/non/existent/file.ts', output)
    expect(result).toBeUndefined()
  })

  test('returns undefined for empty file content', async () => {
    const output = `<file>
</file>`
    const result = await redactOutput(fixture, output)
    expect(result).toBeUndefined()
  })
})
