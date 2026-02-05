import { describe, expect, test } from 'bun:test'
import path from 'path'
import { readFile } from 'fs/promises'
import { hiddenInline, hiddenLine, redactOutput } from '../src/redact'

const fixture = path.join(import.meta.dir, 'fixtures', 'comprehensive.ts')

/**
 * Simulates the tool output format with line numbers like:
 * 00001| content here
 * 00002| more content
 */
function formatAsToolOutput(content: string): string {
  const lines = content.split('\n')
  const paddedLines = lines.map((line, idx) => {
    const lineNum = String(idx + 1).padStart(5, '0')
    return `${lineNum}| ${line}`
  })
  return `<file>\n${paddedLines.join('\n')}\n</file>`
}

describe('redactOutput - comprehensive fixture', () => {
  test('preserves file-level doc comment', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()
    expect(result).toContain('Comprehensive test fixture for redaction testing')
    expect(result).toContain('many different TypeScript/JavaScript patterns')
  })

  test('preserves exported interfaces completely', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()
    // User interface
    expect(result).toContain('export interface User {')
    expect(result).toContain('id: string')
    expect(result).toContain('name: string')
    expect(result).toContain('email: string')
    expect(result).toContain('createdAt: Date')

    // ApiConfig interface
    expect(result).toContain('export interface ApiConfig {')
    expect(result).toContain('baseUrl: string')
    expect(result).toContain('timeout?: number')
  })

  test('preserves exported type aliases', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()
    expect(result).toContain('export type Nullable<T> = T | null')
    expect(result).toContain('export type Optional<T> = T | undefined')
    expect(result).toContain('export type Result<T, E = Error>')
    expect(result).toContain('export type DeepPartial<T>')
  })

  test('preserves exported constants', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()
    expect(result).toContain("export const API_VERSION = 'v1'")
    expect(result).toContain('export const MAX_RETRIES = 3')
    expect(result).toContain('export const DEFAULT_TIMEOUT = 5000')
  })

  test('preserves exported enums', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()
    expect(result).toContain('export enum Status {')
    expect(result).toContain("Pending = 'pending'")
    expect(result).toContain("Active = 'active'")
    expect(result).toContain('export enum HttpMethod {')
  })

  test('hides function implementations but preserves signatures', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Signatures should be preserved
    expect(result).toContain('export function add(a: number, b: number): number {')
    expect(result).toContain('export function multiply(a: number, b: number): number {')
    expect(result).toContain('export function divide(a: number, b: number): number {')

    // Implementation details should be hidden
    expect(result).not.toContain('const result = a + b')
    expect(result).not.toContain('return a * b')
    expect(result).not.toContain('throw new Error')
    expect(result).not.toContain('This is an internal comment')

    // Should contain hidden marker
    expect(result).toContain(hiddenLine)
  })

  test('preserves docstrings for functions', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()
    expect(result).toContain('Adds two numbers together')
    expect(result).toContain('@param a - First number')
    expect(result).toContain('@param b - Second number')
    expect(result).toContain('@returns The sum of a and b')
    expect(result).toContain('Multiplies two numbers')
    expect(result).toContain('Fetches data from an API endpoint')
  })

  test('hides arrow function implementations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Signatures should be preserved
    expect(result).toContain('export const square')
    expect(result).toContain('export const cube')

    // Inline implementations should be hidden
    expect(result).not.toContain('x * x')
    expect(result).toContain(hiddenInline)
  })

  test('hides arrow function block body return statements', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // The return statement inside arrow function block body should be hidden
    // This is a regression test for a bug where "return squared * x" leaked through
    expect(result).not.toContain('return squared * x')
    expect(result).not.toContain('squared * x')
  })

  test('hides async function implementations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Signature preserved
    expect(result).toContain('export async function fetchData<T>(url: string): AsyncResult<T> {')

    // Implementation hidden
    expect(result).not.toContain('await fetch(url)')
    expect(result).not.toContain('response.ok')
    expect(result).not.toContain('response.json()')
  })

  test('hides generator function implementations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Signatures preserved
    expect(result).toContain(
      'export function* range(start: number, end: number, step: number = 1): Generator<number> {',
    )
    expect(result).toContain('export function* fibonacci(): Generator<number> {')

    // Implementation hidden
    expect(result).not.toContain('for (let i = start; i < end; i += step)')
    expect(result).not.toContain('yield i')
    expect(result).not.toContain('[prev, curr] = [curr, prev + curr]')
  })

  test('preserves class signatures and docstrings but hides method bodies', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Class and docstring preserved
    expect(result).toContain('export class Stack<T> {')
    expect(result).toContain('A generic stack data structure')
    expect(result).toContain('Creates a new stack with optional initial items')

    // Method signatures preserved
    expect(result).toContain('push(item: T): void {')
    expect(result).toContain('pop(): T | undefined {')
    expect(result).toContain('peek(): T | undefined {')

    // Implementation hidden
    expect(result).not.toContain('this.items.push(item)')
    expect(result).not.toContain('this.items.pop()')
    expect(result).not.toContain('this.items[this.items.length - 1]')
  })

  test('hides private property initializers', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Property declaration preserved but initializer hidden
    expect(result).toContain('private items: T[]')
    expect(result).toContain(hiddenInline)
  })

  test('handles EventEmitter class complexity', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Class preserved
    expect(result).toContain('export class EventEmitter<T extends Record<string, unknown[]>> {')
    expect(result).toContain('An event emitter implementation')

    // Method signatures preserved
    expect(result).toContain(
      'on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): () => void {',
    )
    expect(result).toContain('emit<K extends keyof T>(event: K, ...args: T[K]): void {')

    // Implementation hidden
    expect(result).not.toContain('this.listeners.set(event')
    expect(result).not.toContain('for (const listener of listeners)')
  })

  test('handles singleton pattern class', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    expect(result).toContain('export class Logger {')
    expect(result).toContain('A singleton logger class')
    expect(result).toContain('static getInstance(): Logger {')

    // Private constructor comment should be hidden
    expect(result).not.toContain('Private constructor to enforce singleton')
  })

  test('handles abstract classes and inheritance', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Abstract class preserved
    expect(result).toContain('export abstract class Shape {')
    expect(result).toContain('abstract readonly name: string')
    expect(result).toContain('abstract area(): number')
    expect(result).toContain('abstract perimeter(): number')

    // Concrete implementations
    expect(result).toContain('export class Circle extends Shape {')
    expect(result).toContain('export class Rectangle extends Shape {')

    // Implementation hidden
    expect(result).not.toContain('Math.PI * this.radius * this.radius')
    expect(result).not.toContain('this.width * this.height')
  })

  test('hides decorator-like function implementations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Signatures preserved
    expect(result).toContain(
      'export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {',
    )
    expect(result).toContain('export function debounce<T extends (...args: unknown[]) => unknown>')
    expect(result).toContain('export function throttle<T extends (...args: unknown[]) => unknown>')

    // Implementation hidden
    expect(result).not.toContain('const cache = new Map')
    expect(result).not.toContain('JSON.stringify(args)')
    expect(result).not.toContain('clearTimeout(timeoutId)')
  })

  test('handles object literals with methods', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Object structure preserved
    expect(result).toContain('export const mathUtils = {')
    expect(result).toContain('factorial(n: number): number {')
    expect(result).toContain('gcd(a: number, b: number): number {')

    // Docstrings preserved
    expect(result).toContain('Calculates factorial of n')
    expect(result).toContain('Calculates the greatest common divisor')

    // Simple values should be preserved
    expect(result).toContain('PI: 3.14159')
    expect(result).toContain('E: 2.71828')

    // Method bodies hidden
    expect(result).not.toContain('n * this.factorial(n - 1)')
    expect(result).not.toContain('[a, b] = [b, a % b]')
  })

  test('handles stringUtils object', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    expect(result).toContain('export const stringUtils = {')

    // Arrow function implementations in object should be hidden
    expect(result).not.toContain('str.charAt(0).toUpperCase() + str.slice(1)')
    expect(result).not.toContain("str.split('').reverse().join('')")
  })

  test('preserves complex nested config objects', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Nested structure should be preserved (it's just data, no functions)
    expect(result).toContain('export const config = {')
    expect(result).toContain('server: {')
    expect(result).toContain("host: 'localhost'")
    expect(result).toContain('port: 3000')
    expect(result).toContain('database: {')
    expect(result).toContain('features: {')
  })

  test('completely hides non-exported private helpers', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // These should not appear at all
    expect(result).not.toContain('function privateHelper')
    expect(result).not.toContain('const internalConstant = 42')
    expect(result).not.toContain('const computeSecret')
    expect(result).not.toContain('async function fetchInternal')

    // Hidden line marker should appear where these were
    expect(result).toContain(hiddenLine)
  })

  test('completely hides non-exported classes including declarations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Non-exported class declarations should be completely hidden, not just their bodies
    expect(result).not.toContain('class InternalCache')
    expect(result).not.toContain('class InternalCache<T>')
  })

  test('completely hides private methods in exported classes including declarations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Public class and public methods should be visible
    expect(result).toContain('export class SecureService {')
    expect(result).toContain('public fetchData(url: string): Promise<string> {')

    // Private method declarations should be completely hidden, not just their bodies
    expect(result).not.toContain('private buildUrl')
    expect(result).not.toContain('private async makeRequest')
    expect(result).not.toContain('private static validateKey')

    // Private method implementation details should definitely be hidden
    expect(result).not.toContain('super-secret-key-123')
    expect(result).not.toContain('https://api.example.com')
    expect(result).not.toContain('X-API-Key')
  })

  test('hides higher-order function implementations', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Signature preserved
    expect(result).toContain('export function createCounter(initial: number = 0)')
    expect(result).toContain('export function createValidator<T>')

    // Implementation hidden
    expect(result).not.toContain('let count = initial')
    expect(result).not.toContain('increment: () => ++count')
    expect(result).not.toContain('const errors: string[] = []')
  })

  test('hides default export implementation', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // The default export line should be preserved
    expect(result).toContain('export default defaultPlugin')

    // But the implementation should be hidden
    expect(result).not.toContain("name: 'comprehensive-fixture'")
    expect(result).not.toContain("version: '1.0.0'")
    expect(result).not.toContain("console.log('Plugin initialized')")
  })

  test('preserves line count', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Extract just the content between <file> tags
    const contentMatch = result!.match(/<file>\n([\s\S]*)\n<\/file>/)
    expect(contentMatch).toBeDefined()

    const resultContent = contentMatch![1]!
    const inputLines = input.split('\n')
    const resultLines = resultContent.split('\n')

    // Line count should be preserved
    expect(resultLines.length).toBe(inputLines.length)
  })

  test('MAGIC_NUMBERS const object is preserved', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    expect(result).toContain('export const MAGIC_NUMBERS = {')
    expect(result).toContain('GOLDEN_RATIO: 1.618033988749895')
    expect(result).toContain('PI: 3.141592653589793')
    expect(result).toContain('E: 2.718281828459045')
  })

  test('handles complex generic functions like compose and curry', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // These are arrow functions with complex generics
    expect(result).toContain('export const identity')
    expect(result).toContain('export const compose')
    expect(result).toContain('export const curry')

    // Implementation should be hidden
    expect(result).not.toContain('=> f(g(a))')
    expect(result).not.toContain('=> fn(a, b)')
  })

  test('handles delay Promise arrow function', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    expect(result).toContain('export const delay')
    expect(result).not.toContain('new Promise((resolve)')
    expect(result).not.toContain('setTimeout(resolve, ms)')
  })

  test('handles retry function with complex implementation', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    // Signature with default parameter should be preserved
    expect(result).toContain('export async function retry<T>')

    // Implementation hidden
    expect(result).not.toContain('let lastError')
    expect(result).not.toContain('for (let i = 0; i < maxRetries')
    expect(result).not.toContain('Math.pow(2, i)')
  })

  test('handles pipe function', async () => {
    const input = await readFile(fixture, 'utf-8')
    const output = formatAsToolOutput(input)
    const result = await redactOutput(fixture, output)

    expect(result).toBeDefined()

    expect(result).toContain('export const pipe')
    expect(result).not.toContain('fns.reduce((acc, fn) => fn(acc), initial)')
  })
})
