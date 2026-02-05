import {
  SyntaxKind,
  type Expression,
  type Node,
  type PropertyDeclaration,
  type VariableDeclaration,
} from 'ts-morph'
import { sourceFile } from './ast'

export const hiddenLine = '// implementation hidden'
export const hiddenInline = '/* implementation hidden */'

type InlineEdit = {
  line: number
  start: number
  end: number
  text: string
}

type LineEdit = {
  line: number
  text: string
}

type BlockEdit = {
  start: number
  end: number
  line: number
  priority: number
}

type LineWindow = {
  start: number
  end: number
}

export async function redactOutput(title: string, output: string) {
  const fileTag = '<file>\n'
  const start = output.indexOf(fileTag)
  if (start === -1) return

  const tail = output.slice(start + fileTag.length)
  const end = tail.indexOf('\n</file>')
  if (end === -1) return

  const fileSection = tail.slice(0, end)
  const lines = fileSection.split('\n')
  const data: { prefix: string; text: string }[] = []
  let prefixLength = 0

  for (const line of lines) {
    const match = line.match(/^(\d*\| )([\s\S]*)$/)
    if (!match || !match[1]) break
    data.push({ prefix: match[1], text: match[2] ?? '' })
    prefixLength += 1
  }

  if (data.length === 0) return

  const startPrefix = data[0]?.prefix ?? ''
  const endPrefix = data[data.length - 1]?.prefix ?? ''
  const window = lineWindow(startPrefix, endPrefix)
  if (!window) return

  let sourceText: string
  try {
    sourceText = await Bun.file(title).text()
  } catch {
    return
  }

  const redacted = redactFile(title, sourceText, window)
  const redactedLines = redacted.split('\n')

  if (redactedLines.length < window.end) return

  const updated = redactedLines.slice(window.start - 1, window.end)
  if (updated.length !== data.length) return

  const rebuilt = data.map((entry, i) => `${entry.prefix}${updated[i] ?? ''}`)
  const content = [...rebuilt, ...lines.slice(prefixLength)].join('\n')
  const fileEnd = start + fileTag.length + end
  return `${output.slice(0, start + fileTag.length)}${content}${output.slice(fileEnd)}`
}

export function redactFile(filePath: string, text: string, window?: LineWindow) {
  const file = sourceFile(filePath, text)
  const lines = text.split('\n')
  const inline: InlineEdit[] = []
  const replace: LineEdit[] = []
  const blocks: BlockEdit[] = []

  for (const node of file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    if (!node.isExported()) continue
    const body = node.getBody()
    if (!body) continue
    redactBlock(body, lines, inline, replace, blocks, 3)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
    if (!isExportedClassMember(node)) continue
    const body = node.getBody()
    if (!body) continue
    redactBlock(body, lines, inline, replace, blocks, 3)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.Constructor)) {
    if (!isExportedClassMember(node)) continue
    const body = node.getBody()
    if (!body) continue
    redactBlock(body, lines, inline, replace, blocks, 3)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.GetAccessor)) {
    if (!isExportedClassMember(node)) continue
    const body = node.getBody()
    if (!body) continue
    redactBlock(body, lines, inline, replace, blocks, 3)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.SetAccessor)) {
    if (!isExportedClassMember(node)) continue
    const body = node.getBody()
    if (!body) continue
    redactBlock(body, lines, inline, replace, blocks, 3)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.PropertyDeclaration)) {
    if (!isExportedClassMember(node)) continue
    if (!node.getInitializer()) continue
    redactInitializer(node, lines, inline, replace, blocks, 3)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.ExportAssignment)) {
    const expr = node.getExpression()
    if (!expr) continue
    if (expr.getKind() === SyntaxKind.ArrowFunction) {
      const body = expr.getFirstChildByKind(SyntaxKind.Block)
      if (body) {
        redactBlock(body, lines, inline, replace, blocks, 3)
        continue
      }
      redactExpression(expr, lines, inline, replace, blocks, 3)
    }
    if (expr.getKind() === SyntaxKind.FunctionExpression) {
      const body = expr.getFirstChildByKind(SyntaxKind.Block)
      if (!body) continue
      redactBlock(body, lines, inline, replace, blocks, 3)
    }
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (!node.getInitializer()) continue
    if (!isExportedVariable(node)) continue
    redactVariableInitializer(node, lines, inline, replace, blocks, 2)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.ArrowFunction)) {
    if (!isExportedArrowFunction(node)) continue
    const body = node.getBody()
    if (body.getKind() === SyntaxKind.Block) {
      redactBlock(body, lines, inline, replace, blocks, 1)
      continue
    }
    redactExpression(body as Expression, lines, inline, replace, blocks, 1)
  }

  for (const node of file.getDescendantsOfKind(SyntaxKind.FunctionExpression)) {
    if (!isExportedFunctionExpression(node)) continue
    const body = node.getBody()
    if (!body) continue
    redactBlock(body, lines, inline, replace, blocks, 2)
  }

  applyEdits(lines, inline, replace, blocks, window)
  return lines.join('\n')
}

function redactBlock(
  body: Node,
  lines: string[],
  inline: InlineEdit[],
  replace: LineEdit[],
  blocks: BlockEdit[],
  priority: number,
) {
  const startLine = body.getStartLineNumber()
  const endLine = body.getEndLineNumber()

  if (startLine === endLine) {
    const start = lineCol(body, body.getStart() + 1)
    const end = lineCol(body, body.getEnd() - 1)
    inline.push({
      line: start.line,
      start: start.column,
      end: end.column,
      text: ` ${hiddenInline} `,
    })
    return
  }

  if (startLine + 1 === endLine) {
    const line = lines[startLine - 1] ?? ''
    const braceIndex = line.indexOf('{')
    const insert =
      braceIndex === -1
        ? `${line} ${hiddenLine}`
        : `${line.slice(0, braceIndex + 1)} ${hiddenLine}${line.slice(braceIndex + 1)}`
    replace.push({ line: startLine, text: insert })
    return
  }

  blocks.push({ start: startLine + 1, end: endLine - 1, line: startLine + 1, priority })
}

function redactExpression(
  node: Expression,
  lines: string[],
  inline: InlineEdit[],
  replace: LineEdit[],
  blocks: BlockEdit[],
  priority: number,
) {
  const start = lineCol(node, node.getStart())
  const end = lineCol(node, node.getEnd())

  if (start.line === end.line) {
    inline.push({ line: start.line, start: start.column, end: end.column, text: hiddenInline })
    return
  }

  blocks.push({ start: start.line, end: end.line, line: start.line, priority })
}

function redactInitializer(
  node: PropertyDeclaration,
  lines: string[],
  inline: InlineEdit[],
  replace: LineEdit[],
  blocks: BlockEdit[],
  priority: number,
) {
  const init = node.getInitializer()
  if (!init) return
  const equals = node.getFirstChildByKind(SyntaxKind.EqualsToken)
  if (!equals) return

  const start = lineCol(node, equals.getStart())
  const end = lineCol(node, init.getEnd())

  if (start.line === end.line) {
    inline.push({
      line: start.line,
      start: start.column,
      end: end.column,
      text: `= ${hiddenInline}`,
    })
    return
  }

  const first = lines[start.line - 1] ?? ''
  const prefix = first.slice(0, start.column - 1).trimEnd()
  replace.push({ line: start.line, text: `${prefix}= ${hiddenInline}` })

  const last = lines[end.line - 1] ?? ''
  const indent = last.match(/^\s*/)?.[0] ?? ''
  replace.push({ line: end.line, text: `${indent}${last.slice(end.column - 1).trimStart()}` })

  blocks.push({ start: start.line + 1, end: end.line - 1, line: start.line + 1, priority })
}

function redactVariableInitializer(
  node: VariableDeclaration,
  lines: string[],
  inline: InlineEdit[],
  replace: LineEdit[],
  blocks: BlockEdit[],
  priority: number,
) {
  const init = node.getInitializer()
  if (!init) return
  const equals = node.getFirstChildByKind(SyntaxKind.EqualsToken)
  if (!equals) return

  const start = lineCol(node, equals.getStart())
  const end = lineCol(node, init.getEnd())

  if (start.line === end.line) {
    inline.push({
      line: start.line,
      start: start.column,
      end: end.column,
      text: `= ${hiddenInline}`,
    })
    return
  }

  const first = lines[start.line - 1] ?? ''
  const prefix = first.slice(0, start.column - 1).trimEnd()
  replace.push({ line: start.line, text: `${prefix}= ${hiddenInline}` })

  const last = lines[end.line - 1] ?? ''
  const indent = last.match(/^\s*/)?.[0] ?? ''
  replace.push({ line: end.line, text: `${indent}${last.slice(end.column - 1).trimStart()}` })

  blocks.push({ start: start.line + 1, end: end.line - 1, line: start.line + 1, priority })
}

function applyEdits(
  lines: string[],
  inline: InlineEdit[],
  replace: LineEdit[],
  blocks: BlockEdit[],
  window?: LineWindow,
) {
  const windowed = window ?? { start: 1, end: lines.length }
  const filteredBlocks = blocks
    .filter((block) => block.end >= windowed.start && block.start <= windowed.end)
    .sort((a, b) => b.priority - a.priority || a.start - b.start)

  const appliedBlocks: BlockEdit[] = []

  for (const block of filteredBlocks) {
    if (appliedBlocks.some((applied) => rangesOverlap(applied, block))) continue
    appliedBlocks.push(block)
    if (block.start > block.end) continue
    if (block.start < 1 || block.end > lines.length) continue

    const base = lines[block.line - 1] ?? ''
    const indent = base.match(/^\s*/)?.[0] ?? ''
    lines[block.line - 1] = `${indent}${hiddenLine}`

    for (let i = block.line + 1; i <= block.end; i += 1) {
      lines[i - 1] = ''
    }
  }

  for (const item of replace) {
    if (item.line < 1 || item.line > lines.length) continue
    if (item.line < windowed.start || item.line > windowed.end) continue
    lines[item.line - 1] = item.text
  }

  if (inline.length === 0) return

  const grouped = new Map<number, InlineEdit[]>()
  for (const item of inline) {
    if (item.line < windowed.start || item.line > windowed.end) continue
    const list = grouped.get(item.line) ?? []
    list.push(item)
    grouped.set(item.line, list)
  }

  for (const [line, items] of grouped.entries()) {
    if (line < 1 || line > lines.length) continue
    const sorted = [...items].sort((a, b) => b.start - a.start)
    let text = lines[line - 1] ?? ''

    for (const edit of sorted) {
      const start = Math.max(edit.start - 1, 0)
      const end = Math.max(edit.end - 1, start)
      text = `${text.slice(0, start)}${edit.text}${text.slice(end)}`
    }

    lines[line - 1] = text
  }
}

function lineCol(node: Node, pos: number) {
  return node.getSourceFile().getLineAndColumnAtPos(pos)
}

function lineWindow(startPrefix?: string, endPrefix?: string) {
  const start = parseLinePrefix(startPrefix)
  const end = parseLinePrefix(endPrefix)
  if (start == null || end == null) return
  return { start, end }
}

function isExportedClassMember(node: Node) {
  const parent = node.getParentIfKind(SyntaxKind.ClassDeclaration)
  if (!parent) return false
  if (!parent.isExported()) return false
  const privateToken = node.getFirstChildByKind(SyntaxKind.PrivateKeyword)
  if (privateToken) return false
  const protectedToken = node.getFirstChildByKind(SyntaxKind.ProtectedKeyword)
  return !protectedToken
}

function isExportedVariable(node: VariableDeclaration) {
  const statement = node
    .getParentIfKind(SyntaxKind.VariableDeclarationList)
    ?.getParentIfKind(SyntaxKind.VariableStatement)
  if (!statement) return false
  if (statement.isExported()) return true
  return statement.hasModifier(SyntaxKind.ExportKeyword)
}

function isExportedArrowFunction(node: Node) {
  const parent = node.getParentIfKind(SyntaxKind.VariableDeclaration)
  if (!parent) return false
  return isExportedVariable(parent)
}

function isExportedFunctionExpression(node: Node) {
  const parent = node.getParentIfKind(SyntaxKind.VariableDeclaration)
  if (!parent) return false
  return isExportedVariable(parent)
}

function parseLinePrefix(prefix: string | undefined) {
  const safePrefix = prefix ?? ''
  const match = String(safePrefix).match(/^(\d+)\|\s/)
  const numberText = match?.[1]
  if (!numberText) return
  const value = Number.parseInt(numberText, 10)
  if (Number.isNaN(value)) return
  return value
}

function rangesOverlap(left: BlockEdit, right: BlockEdit) {
  return left.start <= right.end && right.start <= left.end
}
