import c from 'ansis'
import { diffLines } from 'diff'

interface DiffHighlightOptions {
  indentSize?: number
  verbose?: boolean
}

export function diffHighlight(original: string, updated: string, options: DiffHighlightOptions = {}): string {
  const { indentSize = 2, verbose = false } = options
  const changed = diffLines(original, updated, {
    ignoreNewlineAtEof: true,
  })

  const diffs: { content: string, type: 'added' | 'removed' | 'unchanged' }[] = []
  for (const part of changed) {
    const lines = part.value.split('\n')
    if (lines[lines.length - 1] === '')
      lines.pop()

    for (const line of lines) {
      diffs.push({
        content: line,
        type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
      })
    }
  }

  const changedLines = new Set<number>()
  for (const [index, line] of diffs.entries()) {
    if (line.type === 'added' || line.type === 'removed')
      changedLines.add(index)
  }

  const lineHierarchy: Array<{ indentLevel: number, parentIndices: number[] }> = []
  for (const [index, line] of diffs.entries()) {
    if (line.content.trim() === '') {
      lineHierarchy.push({ indentLevel: -1, parentIndices: [] })
      continue
    }

    const currentIndent = line.content.search(/\S/)
    const indentLevel = Math.floor(currentIndent / indentSize)
    const parentIndices: number[] = []

    for (let i = index - 1; i >= 0; i--) {
      const prevLine = diffs[i]
      const prevHierarchy = lineHierarchy[i]
      if (prevLine.content.trim() === '')
        continue

      const prevIndent = prevLine.content.search(/\S/)
      const prevIndentLevel = Math.floor(prevIndent / indentSize)
      if (prevIndentLevel < indentLevel) {
        parentIndices.unshift(i)
        if (prevIndentLevel === indentLevel - 1) {
          parentIndices.unshift(...prevHierarchy.parentIndices)
          break
        }
      }
    }

    lineHierarchy.push({ indentLevel, parentIndices })
  }

  const linesToKeep = new Set<number>()
  if (verbose) {
    for (const [index] of diffs.entries())
      linesToKeep.add(index)
  }
  else {
    for (const lineIndex of changedLines) {
      linesToKeep.add(lineIndex)
      for (const parentIndex of lineHierarchy[lineIndex].parentIndices)
        linesToKeep.add(parentIndex)
    }
  }

  let addedCount = 0
  let removedCount = 0
  for (const line of diffs) {
    if (line.type !== 'added' && line.type !== 'removed')
      continue
    if (!isDependencyEntryLine(line.content, indentSize))
      continue

    if (line.type === 'added')
      addedCount++
    else
      removedCount++
  }

  const summaryParts: string[] = []
  if (addedCount > 0)
    summaryParts.push(`${c.yellow(addedCount)} added`)
  if (removedCount > 0)
    summaryParts.push(`${c.yellow(removedCount)} removed`)

  const result: string[] = []
  let lastKeptIndex = -1

  for (const [index, line] of diffs.entries()) {
    if (!linesToKeep.has(index))
      continue

    if (!verbose && lastKeptIndex !== -1 && index > lastKeptIndex + 1) {
      const skippedCount = index - lastKeptIndex - 1
      result.push(c.dim`${c.yellow(skippedCount)} unchanged line${skippedCount > 1 ? 's' : ''}`)
    }

    const highlighted = highlightLine(line.content, indentSize, verbose)
    if (line.type === 'added')
      result.push(c.green(`+ ${highlighted}`))
    else if (line.type === 'removed')
      result.push(c.red(`- ${highlighted}`))
    else
      result.push(`  ${highlighted}`)

    lastKeptIndex = index
  }

  if (summaryParts.length > 0) {
    result.push('')
    result.push(summaryParts.join(' '))
  }

  return result.join('\n')
}

function highlightLine(content: string, indentSize: number, highlightRoot = false): string {
  if (content.trim() === '')
    return content

  const currentIndent = content.search(/\S/)
  const indentLevel = Math.floor(currentIndent / indentSize)
  const colonIndex = content.indexOf(':')
  if (colonIndex === -1)
    return content

  const beforeColon = content.substring(0, colonIndex)
  const afterColon = content.substring(colonIndex)
  const rootStyle = highlightRoot ? c.cyan : c.reset

  const versionMatch = afterColon.match(/:\s*(.+)/)
  const hasValue = !!(versionMatch && versionMatch[1].trim())

  if (indentLevel <= 1) {
    const key = beforeColon.trim()
    const leadingSpaces = content.substring(0, content.indexOf(key))
    return leadingSpaces + rootStyle(key) + c.dim(hasValue ? afterColon : ':')
  }

  return beforeColon + c.dim(hasValue ? afterColon : ':')
}

function isDependencyEntryLine(content: string, indentSize: number): boolean {
  if (content.trim() === '')
    return false

  const currentIndent = content.search(/\S/)
  const indentLevel = Math.floor(currentIndent / indentSize)
  if (indentLevel < 2)
    return false
  if (!content.includes(':'))
    return false

  const colonIndex = content.indexOf(':')
  const afterColon = content.substring(colonIndex)
  const versionMatch = afterColon.match(/:\s*(.+)/)
  return !!(versionMatch && versionMatch[1].trim())
}
