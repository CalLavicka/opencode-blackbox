import { describe, expect, test } from 'bun:test'
import { sourceFile } from '../src/ast'

const filePath = './example.ts'

const input = 'export const value = 1\n'

describe('sourceFile', () => {
  test('returns cached source file for same content', () => {
    const first = sourceFile(filePath, input)
    const second = sourceFile(filePath, input)

    expect(first).toBe(second)
  })
})
