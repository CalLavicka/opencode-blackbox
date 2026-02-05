/**
 * File level doc comment.
 */

export interface User {
  id: string
  name: string
}

export type ApiResult<T> = {
  data: T
  ok: boolean
}

/**
 * Adds numbers together.
 */
export function add(a: number, b: number): number {
  // inline comment should be removed
  return a + b
}

export function keepSignature(a: number, b: number): number {
  const total = a + b
  return total
}

export const multiply = (a: number, b: number) => a * b

export const divide = (a: number, b: number) => {
  return a / b
}

export const foo = {
  bar() {
    return 4
  },
  value: 7,
}

export const baz = () => {
  return 6
}

export function exportedWithInternals(value: number) {
  // internal comment should be hidden
  const internalValue = value + 1
  if (internalValue > 0) {
    return internalValue
  }
  return 0
}

function helperSecret(value: number) {
  return value * 2
}

const hiddenValue = 42

const plugin = (value: number) => {
  return value + 1
}

export default plugin

export class Counter {
  /**
   * Starting value.
   */
  private value: number = 0

  constructor(initial: number) {
    this.value = initial
  }

  get current(): number {
    return this.value
  }

  set current(next: number) {
    this.value = next
  }

  increment(by: number): number {
    const next = this.value + by
    this.value = next
    return this.value
  }
}
