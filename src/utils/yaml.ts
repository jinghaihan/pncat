import c from 'ansis'
import { diffLines } from 'diff'

interface DiffYAMLOptions {
  indentSize?: number
  verbose?: boolean
}

function highlightYAMLContent(content: string, indentSize: number = 2, highlight: boolean = false): string {
  if (content.trim() === '') {
    return content
  }

  const currentIndent = content.search(/\S/)
  const indentLevel = Math.floor(currentIndent / indentSize)

  const colonIndex = content.indexOf(':')
  if (colonIndex === -1) {
    return content
  }

  const beforeColon = content.substring(0, colonIndex)
  const afterColon = content.substring(colonIndex)
  const ansi = highlight ? c.cyan : c.reset

  if (indentLevel === 0 || indentLevel === 1) {
    const propertyName = beforeColon.trim()
    const leadingSpaces = content.substring(0, content.indexOf(propertyName))

    const versionMatch = afterColon.match(/:\s*(.+)/)
    if (versionMatch && versionMatch[1].trim())
      return leadingSpaces + ansi(propertyName) + c.dim(afterColon)
    else
      return leadingSpaces + ansi(propertyName) + c.dim(':')
  }
  else {
    const versionMatch = afterColon.match(/:\s*(.+)/)
    if (versionMatch && versionMatch[1].trim())
      return beforeColon + c.dim(afterColon)
    else
      return beforeColon + c.dim(':')
  }
}

export function diffYAML(original: string, updated: string, options: DiffYAMLOptions = {}) {
  const { indentSize = 2, verbose = false } = options

  const changed = diffLines(original, updated, {
    ignoreNewlineAtEof: true,
  })

  const diffs: { content: string, type: 'added' | 'removed' | 'unchanged', lineNumber: number }[] = []

  let lineNumber = 0
  changed.forEach((part) => {
    const lines = part.value.split('\n')
    if (lines[lines.length - 1] === '') {
      lines.pop()
    }

    lines.forEach((line) => {
      diffs.push({
        content: line,
        type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
        lineNumber: lineNumber++,
      })
    })
  })

  const changedLines = new Set<number>()
  diffs.forEach((line, index) => {
    if (line.type === 'added' || line.type === 'removed')
      changedLines.add(index)
  })

  const lineHierarchy: Array<{ indentLevel: number, parentIndices: number[] }> = []
  diffs.forEach((line, index) => {
    const content = line.content
    if (content.trim() === '') {
      lineHierarchy.push({ indentLevel: -1, parentIndices: [] })
      return
    }

    const currentIndent = content.search(/\S/)
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
  })

  const linesToKeep = new Set<number>()

  if (verbose) {
    diffs.forEach((_, index) => {
      linesToKeep.add(index)
    })
  }
  else {
    changedLines.forEach((lineIndex) => {
      linesToKeep.add(lineIndex)
      lineHierarchy[lineIndex].parentIndices.forEach((parentIndex) => {
        linesToKeep.add(parentIndex)
      })
    })
  }

  let addedCount = 0
  let removedCount = 0
  diffs.forEach((line) => {
    if (line.type === 'added' || line.type === 'removed') {
      const content = line.content
      if (content.trim() === '')
        return

      const currentIndent = content.search(/\S/)
      const indentLevel = Math.floor(currentIndent / indentSize)

      if (indentLevel >= 2 && content.includes(':')) {
        const colonIndex = content.indexOf(':')
        const afterColon = content.substring(colonIndex)
        const versionMatch = afterColon.match(/:\s*(.+)/)

        if (versionMatch && versionMatch[1].trim()) {
          if (line.type === 'added')
            addedCount++
          else if (line.type === 'removed')
            removedCount++
        }
      }
    }
  })

  const summaryParts: string[] = []
  if (addedCount > 0) {
    summaryParts.push(`${c.yellow(addedCount)} added`)
  }
  if (removedCount > 0) {
    summaryParts.push(`${c.yellow(removedCount)} removed`)
  }

  const result: string[] = []

  let lastKeptIndex = -1

  diffs.forEach((line, index) => {
    if (linesToKeep.has(index)) {
      if (!verbose && lastKeptIndex !== -1 && index > lastKeptIndex + 1) {
        const skippedCount = index - lastKeptIndex - 1
        result.push(c.dim`${c.yellow(skippedCount)} unchanged line${skippedCount > 1 ? 's' : ''}`)
      }

      let coloredLine = line.content
      if (line.type === 'added') {
        const highlightedContent = highlightYAMLContent(line.content, indentSize, verbose)
        coloredLine = c.green(`+ ${highlightedContent}`)
      }
      else if (line.type === 'removed') {
        const highlightedContent = highlightYAMLContent(line.content, indentSize, verbose)
        coloredLine = c.red(`- ${highlightedContent}`)
      }
      else {
        const highlightedContent = highlightYAMLContent(line.content, indentSize, verbose)
        coloredLine = `  ${highlightedContent}`
      }

      result.push(coloredLine)
      lastKeptIndex = index
    }
  })

  if (summaryParts.length > 0) {
    result.push('')
    result.push(summaryParts.join(' '))
  }

  return result.join('\n')
}
