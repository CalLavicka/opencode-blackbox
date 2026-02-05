/**
 * Comprehensive test fixture for redaction testing.
 * This file contains many different TypeScript/JavaScript patterns
 * to test the redaction logic thoroughly.
 */

// ============================================
// INTERFACES AND TYPES
// ============================================

/**
 * Represents a user in the system.
 */
export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

/**
 * Configuration options for the API client.
 */
export interface ApiConfig {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
  retryCount?: number
}

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>

/**
 * A complex mapped type.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// ============================================
// CONSTANTS AND ENUMS
// ============================================

export const API_VERSION = 'v1'
export const MAX_RETRIES = 3
export const DEFAULT_TIMEOUT = 5000

export const MAGIC_NUMBERS = {
  GOLDEN_RATIO: 1.618033988749895,
  PI: 3.141592653589793,
  E: 2.718281828459045,
} as const

export enum Status {
  Pending = 'pending',
  Active = 'active',
  Completed = 'completed',
  Failed = 'failed',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

// ============================================
// SIMPLE FUNCTIONS
// ============================================

/**
 * Adds two numbers together.
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  // This is an internal comment that should be hidden
  const result = a + b
  return result
}

/**
 * Multiplies two numbers.
 */
export function multiply(a: number, b: number): number {
  return a * b
}

export function subtract(a: number, b: number): number {
  const difference = a - b
  return difference
}

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Cannot divide by zero')
  }
  return a / b
}

// ============================================
// ARROW FUNCTIONS
// ============================================

export const square = (x: number): number => x * x

export const cube = (x: number): number => {
  const squared = x * x
  return squared * x
}

export const identity = <T>(value: T): T => value

export const compose = <A, B, C>(f: (b: B) => C, g: (a: A) => B) => (a: A): C => f(g(a))

export const curry =
  <A, B, C>(fn: (a: A, b: B) => C) =>
  (a: A) =>
  (b: B): C =>
    fn(a, b)

// ============================================
// ASYNC FUNCTIONS
// ============================================

/**
 * Fetches data from an API endpoint.
 */
export async function fetchData<T>(url: string): AsyncResult<T> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { ok: false, error: new Error(`HTTP ${response.status}`) }
    }
    const data = await response.json()
    return { ok: true, value: data as T }
  } catch (error) {
    return { ok: false, error: error as Error }
  }
}

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      await delay(100 * Math.pow(2, i))
    }
  }
  throw lastError
}

// ============================================
// GENERATOR FUNCTIONS
// ============================================

export function* range(start: number, end: number, step: number = 1): Generator<number> {
  for (let i = start; i < end; i += step) {
    yield i
  }
}

export function* fibonacci(): Generator<number> {
  let prev = 0
  let curr = 1
  while (true) {
    yield prev
    ;[prev, curr] = [curr, prev + curr]
  }
}

export async function* asyncRange(
  start: number,
  end: number
): AsyncGenerator<number> {
  for (let i = start; i < end; i++) {
    await delay(10)
    yield i
  }
}

// ============================================
// CLASSES
// ============================================

/**
 * A generic stack data structure.
 */
export class Stack<T> {
  private items: T[] = []

  /**
   * Creates a new stack with optional initial items.
   */
  constructor(initial?: T[]) {
    if (initial) {
      this.items = [...initial]
    }
  }

  push(item: T): void {
    this.items.push(item)
  }

  pop(): T | undefined {
    return this.items.pop()
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1]
  }

  get size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }
}

/**
 * An event emitter implementation.
 */
export class EventEmitter<T extends Record<string, unknown[]>> {
  private listeners: Map<keyof T, Set<(...args: unknown[]) => void>> = new Map()

  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const listeners = this.listeners.get(event)!
    listeners.add(listener as (...args: unknown[]) => void)

    return () => {
      listeners.delete(listener as (...args: unknown[]) => void)
    }
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        listener(...args)
      }
    }
  }

  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(listener as (...args: unknown[]) => void)
    }
  }
}

/**
 * A singleton logger class.
 */
export class Logger {
  private static instance: Logger | null = null
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'

  private constructor() {
    // Private constructor to enforce singleton
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.logLevel === 'debug') {
      console.log('[DEBUG]', message, ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.logLevel !== 'warn' && this.logLevel !== 'error') {
      console.log('[INFO]', message, ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.logLevel !== 'error') {
      console.warn('[WARN]', message, ...args)
    }
  }

  error(message: string, ...args: unknown[]): void {
    console.error('[ERROR]', message, ...args)
  }
}

/**
 * A class with private methods that should be fully hidden.
 */
export class SecureService {
  private secretKey: string = 'super-secret-key-123'

  constructor(private apiKey: string) {}

  public fetchData(url: string): Promise<string> {
    const fullUrl = this.buildUrl(url)
    return this.makeRequest(fullUrl)
  }

  private buildUrl(path: string): string {
    return `https://api.example.com/${path}?key=${this.secretKey}`
  }

  private async makeRequest(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'X-API-Key': this.apiKey },
    })
    return response.text()
  }

  private static validateKey(key: string): boolean {
    return key.length >= 10 && key.startsWith('sk_')
  }
}

// ============================================
// ABSTRACT CLASSES AND INHERITANCE
// ============================================

export abstract class Shape {
  abstract readonly name: string

  abstract area(): number
  abstract perimeter(): number

  describe(): string {
    return `This is a ${this.name} with area ${this.area()} and perimeter ${this.perimeter()}`
  }
}

export class Circle extends Shape {
  readonly name = 'circle'

  constructor(public radius: number) {
    super()
  }

  area(): number {
    return Math.PI * this.radius * this.radius
  }

  perimeter(): number {
    return 2 * Math.PI * this.radius
  }
}

export class Rectangle extends Shape {
  readonly name = 'rectangle'

  constructor(
    public width: number,
    public height: number
  ) {
    super()
  }

  area(): number {
    return this.width * this.height
  }

  perimeter(): number {
    return 2 * (this.width + this.height)
  }
}

// ============================================
// DECORATORS (as functions)
// ============================================

export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>()
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)!
    }
    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as T
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, wait)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// ============================================
// OBJECT LITERALS WITH METHODS
// ============================================

export const mathUtils = {
  /**
   * Calculates factorial of n.
   */
  factorial(n: number): number {
    if (n <= 1) return 1
    return n * this.factorial(n - 1)
  },

  /**
   * Calculates the greatest common divisor.
   */
  gcd(a: number, b: number): number {
    while (b !== 0) {
      ;[a, b] = [b, a % b]
    }
    return a
  },

  lcm(a: number, b: number): number {
    return (a * b) / this.gcd(a, b)
  },

  isPrime(n: number): boolean {
    if (n < 2) return false
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false
    }
    return true
  },

  PI: 3.14159,
  E: 2.71828,
}

export const stringUtils = {
  capitalize: (str: string): string => str.charAt(0).toUpperCase() + str.slice(1),

  reverse: (str: string): string => str.split('').reverse().join(''),

  isPalindrome(str: string): boolean {
    const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '')
    return cleaned === this.reverse(cleaned)
  },
}

// ============================================
// COMPLEX NESTED STRUCTURES
// ============================================

export const config = {
  server: {
    host: 'localhost',
    port: 3000,
    ssl: {
      enabled: false,
      cert: null as string | null,
      key: null as string | null,
    },
  },
  database: {
    connection: {
      host: 'localhost',
      port: 5432,
      name: 'mydb',
      pool: {
        min: 2,
        max: 10,
        idle: 10000,
      },
    },
  },
  features: {
    enableCache: true,
    enableLogging: true,
    experimental: {
      newParser: false,
      asyncValidation: true,
    },
  },
}

// ============================================
// PRIVATE/NON-EXPORTED HELPERS
// ============================================

function privateHelper(x: number): number {
  return x * 2 + 1
}

const internalConstant = 42

const computeSecret = (a: number, b: number) => {
  return a * b + internalConstant
}

async function fetchInternal(url: string): Promise<unknown> {
  const response = await fetch(url)
  return response.json()
}

class InternalCache<T> {
  private data: Map<string, T> = new Map()

  set(key: string, value: T): void {
    this.data.set(key, value)
  }

  get(key: string): T | undefined {
    return this.data.get(key)
  }
}

// ============================================
// HIGHER ORDER FUNCTIONS
// ============================================

export function createCounter(initial: number = 0) {
  let count = initial
  return {
    increment: () => ++count,
    decrement: () => --count,
    reset: () => {
      count = initial
    },
    get: () => count,
  }
}

export function createValidator<T>(
  rules: Array<(value: T) => string | null>
): (value: T) => string[] {
  return (value: T) => {
    const errors: string[] = []
    for (const rule of rules) {
      const error = rule(value)
      if (error) {
        errors.push(error)
      }
    }
    return errors
  }
}

export const pipe =
  <T>(...fns: Array<(arg: T) => T>) =>
  (initial: T): T =>
    fns.reduce((acc, fn) => fn(acc), initial)

// ============================================
// DEFAULT EXPORT
// ============================================

const defaultPlugin = {
  name: 'comprehensive-fixture',
  version: '1.0.0',
  init: () => {
    console.log('Plugin initialized')
  },
  destroy: () => {
    console.log('Plugin destroyed')
  },
}

export default defaultPlugin
