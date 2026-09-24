/**
 * Structured recipe text — TikTok's AI summary, a creator's own written recipe,
 * or a blog paste — arrives as headed blocks. Finding those blocks is far more
 * reliable than guessing sentence by sentence, so the parser looks for them
 * first and only falls back to prose when there are none.
 */

export type BlockKind = 'ingredients' | 'directions' | 'notes' | 'other'

export interface TextBlock {
  kind: BlockKind
  heading: string
  lines: string[]
}

/** Headings are short. A long line that merely starts with "Ingredients" is prose. */
const MAX_HEADING_LENGTH = 64

/**
 * Each pattern must match the *whole* line. A prefix match is not enough:
 * "Step 1: Preheat the oven" and "Note: bake it longer" are content, and
 * treating them as headings silently drops the text.
 */
const HEADING_PATTERNS: { kind: BlockKind; pattern: RegExp }[] = [
  {
    kind: 'ingredients',
    pattern: /^(?:ingredients?|ingredient\s+list|what\s+you'?ll\s+need|what\s+you\s+need|you(?:'ll)?\s+need|shopping\s+list)(?:\s+for\s+[^:]{1,40})?\s*(?:\([^)]*\))?\s*:?$/i,
  },
  {
    kind: 'directions',
    pattern: /^(?:(?:reheat(?:ing)?|cooking|baking|assembly|prep|serving|freezing|storage|sauce|dressing|marinade|topping|filling|recipe)\s+)?(?:step[-\s]?by[-\s]?step\s+)?(?:directions?|instructions?|method|steps|how\s+to\s+make(?:\s+it)?|how\s+to|preparation|procedure)(?:\s*\([^)]*\))?\s*:?$/i,
  },
  {
    kind: 'notes',
    pattern: /^(?:quick\s+|recipe\s+|chef'?s?\s+)?(?:notes?|tips?(?:\s+(?:and|&)\s+(?:variations?|tricks))?|variations?|why\s+this\s+works|storage|make[-\s]ahead|substitutions?)\s*:?$/i,
  },
  {
    // Recognised so they terminate the previous block instead of polluting it.
    kind: 'other',
    pattern: /^(?:lead|summary|overview|closing(?:\s*\/?\s*call\s+to\s+action)?|call\s+to\s+action|keywords?|nutrition(?:\s+(?:facts|info(?:rmation)?))?|equipment)\s*:?$/i,
  },
]

export function classifyHeading(line: string): BlockKind | null {
  const trimmed = line.trim().replace(/^[#*\-•\s]+/, '')
  if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) return null

  // A heading is a label, not a sentence: it may carry a colon or a
  // parenthetical ("Ingredients (serves 2-4):") but not sentence punctuation.
  if (/[.!?]\s*\S/.test(trimmed)) return null

  for (const { kind, pattern } of HEADING_PATTERNS) {
    if (pattern.test(trimmed)) return kind
  }
  return isGroupIngredientsHeading(trimmed) ? 'ingredients' : null
}

/** Words that make "… ingredients" a sentence rather than a heading. */
const SENTENCE_LEADS = new Set([
  'mix', 'combine', 'add', 'whisk', 'stir', 'fold', 'blend', 'the', 'all', 'your',
  'these', 'those', 'my', 'our', 'other', 'remaining', 'some', 'simple', 'with',
])

/**
 * "Dry ingredients:", "Sauce Ingredients", "Spicy Mayo Ingredients" — a heading
 * that also names a group. "Mix the ingredients" is an instruction, not one.
 */
function isGroupIngredientsHeading(line: string): boolean {
  const match = /^([A-Za-z][\w'’&-]*(?:\s+[\w'’&-]+){0,2})\s+ingredients?(?:\s*\([^)]*\))?\s*:?$/i.exec(line)
  return match !== null && !SENTENCE_LEADS.has(match[1].split(/\s+/)[0].toLowerCase())
}

/**
 * Splits text into headed blocks. Unrecognised lines before the first heading
 * become a leading "other" block, so nothing is silently dropped.
 */
export function splitIntoBlocks(text: string): TextBlock[] {
  const lines = text.split('\n').map((line) => line.trim())
  const blocks: TextBlock[] = []
  let current: TextBlock = { kind: 'other', heading: '', lines: [] }

  for (const line of lines) {
    if (!line) continue
    const kind = classifyHeading(line)
    if (kind) {
      if (current.lines.length > 0 || current.heading) blocks.push(current)
      current = { kind, heading: line, lines: [] }
      continue
    }
    current.lines.push(line)
  }

  if (current.lines.length > 0 || current.heading) blocks.push(current)
  return blocks
}

export function hasHeadings(blocks: TextBlock[]): boolean {
  return blocks.some((block) => block.heading !== '')
}
