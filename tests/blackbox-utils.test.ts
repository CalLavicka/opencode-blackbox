import { describe, expect, test } from 'bun:test'
import { matchesAny, parseAllowed, shouldBlackbox } from '../src/blackbox-utils'

const agent = {
  name: 'tester',
  options: {
    blackbox: true,
    blackboxAllow: ['docs/**'],
  },
}

describe('blackbox utils', () => {
  test('shouldBlackbox respects agent option', () => {
    expect(shouldBlackbox(agent)).toBe(true)
    expect(shouldBlackbox({ name: 'other', options: {} })).toBe(false)
    expect(shouldBlackbox(undefined)).toBe(false)
  })

  test('parseAllowed merges defaults and agent allowlist', () => {
    const allow = parseAllowed(agent)
    expect(matchesAny('docs/readme.md', allow)).toBe(true)
    expect(matchesAny('tests/example.test.ts', allow)).toBe(true)
  })
})
