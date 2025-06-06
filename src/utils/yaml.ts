import type { Document } from 'yaml'
import c from 'ansis'

export function safeYAMLDeleteIn(doc: Document, path: Iterable<unknown> | null) {
  if (doc.hasIn(path)) {
    doc.deleteIn(path)
  }
}

export function highlightYAML(yamlContent: string): string {
  const lines = yamlContent.split('\n')
  let indentLevel = 0
  const indentSize = 2

  return lines.map((line) => {
    if (line.trim() === '')
      return line

    const currentIndent = line.search(/\S/)
    const newIndentLevel = Math.floor(currentIndent / indentSize)

    const specifierMatch = line.match(/(:)\s*(['"])?([~^<>=]*\d[\w.\-]*)(['"])?/)
    if (specifierMatch) {
      const beforeSpecifier = line.substring(0, specifierMatch.index! + 1)
      const openingQuote = specifierMatch[2] || ''
      const specifier = specifierMatch[3]
      const closingQuote = specifierMatch[4] || ''
      return `${c.cyan(beforeSpecifier)} ${openingQuote}${c.green(specifier)}${closingQuote}`
    }

    indentLevel = newIndentLevel

    const colors = [c.magenta, c.yellow]
    const color = colors[Math.min(indentLevel, colors.length - 1)] || c.reset

    return color(line)
  }).join('\n')
}
