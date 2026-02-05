import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { matchesAny, normalize, parseAllowed, shouldBlackbox } from '../src/blackbox-utils'

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

describe('normalize', () => {
  test('preserves absolute paths', () => {
    expect(normalize('/Users/test/file.ts')).toBe('/Users/test/file.ts')
  })

  test('preserves relative paths', () => {
    expect(normalize('src/file.ts')).toBe('src/file.ts')
  })

  test('strips leading ./', () => {
    expect(normalize('./src/file.ts')).toBe('src/file.ts')
  })

  test('preserves ../ paths', () => {
    expect(normalize('../file.ts')).toBe('../file.ts')
  })

  test('preserves trailing slashes', () => {
    expect(normalize('src/folder/')).toBe('src/folder/')
  })
})

describe('matchesAny', () => {
  const globs = [new Glob('tests/**'), new Glob('*.md'), new Glob('src/*.ts')]

  test('matches recursive glob pattern', () => {
    expect(matchesAny('tests/foo.ts', globs)).toBe(true)
    expect(matchesAny('tests/nested/bar.ts', globs)).toBe(true)
  })

  test('matches extension pattern at root', () => {
    expect(matchesAny('README.md', globs)).toBe(true)
  })

  test('does not match extension pattern in subdirectory', () => {
    expect(matchesAny('docs/guide.md', globs)).toBe(false)
  })

  test('matches single-level wildcard', () => {
    expect(matchesAny('src/index.ts', globs)).toBe(true)
  })

  test('does not match nested paths with single-level wildcard', () => {
    expect(matchesAny('src/nested/file.ts', globs)).toBe(false)
  })

  test('returns false for non-matching paths', () => {
    expect(matchesAny('other/file.js', globs)).toBe(false)
  })

  test('returns false for empty glob array', () => {
    expect(matchesAny('any/file.ts', [])).toBe(false)
  })
})
