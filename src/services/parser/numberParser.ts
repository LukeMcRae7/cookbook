/**
 * Numbers as people say them out loud: "two", "a couple", "1 1/2", "0.75", "2-3", "½".
 * Pure functions, no dependencies — trivially unit-testable.
 */

export const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  couple: 2, few: 3, dozen: 12,
}

export const WORD_FRACTIONS: Record<string, number> = {
  half: 0.5, halves: 0.5, third: 1 / 3, thirds: 1 / 3, quarter: 0.25,
  quarters: 0.25, fourth: 0.25, eighth: 0.125,
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2,
  '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125,
  '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

export interface QuantityMatch {
  /** Numeric value. For a range this is the lower bound. */
  value: number
  /** What to show the user before any scaling ("1 1/2", "2-3"). */
  display: string
  /** How many tokens were consumed from the front of the input. */
  consumed: number
  isRange: boolean
}

const isUnicodeFraction = (token: string) => token in UNICODE_FRACTIONS

/** "3/4" | "1/2" -> number, else null. */
function parseSlashFraction(token: string): number | null {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(token)
  if (!m) return null
  const denominator = Number(m[2])
  if (denominator === 0) return null
  return Number(m[1]) / denominator
}

/** A single standalone token: "2", "2.5", "3/4", "½", "1½", "two". */
export function parseNumericToken(rawToken: string): number | null {
  const token = rawToken.trim().toLowerCase().replace(/,(?=\d{3}\b)/g, '')
  if (!token) return null

  if (isUnicodeFraction(token)) return UNICODE_FRACTIONS[token]

  // "1½" written without a space
  const glued = /^(\d+)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/.exec(token)
  if (glued) return Number(glued[1]) + UNICODE_FRACTIONS[glued[2]]

  const slash = parseSlashFraction(token)
  if (slash !== null) return slash

  // "1-1/2" — the hyphenated mixed number US recipe cards love
  const hyphenMixed = /^(\d+)-(\d+)\/(\d+)$/.exec(token)
  if (hyphenMixed && Number(hyphenMixed[3]) !== 0) {
    return Number(hyphenMixed[1]) + Number(hyphenMixed[2]) / Number(hyphenMixed[3])
  }

  // "1,5" — a decimal comma, but never a thousands separator ("1,000")
  const decimalComma = /^(\d+),(\d{1,2})$/.exec(token)
  if (decimalComma) return Number(`${decimalComma[1]}.${decimalComma[2]}`)

  if (/^\d+(\.\d+)?$/.test(token)) return Number(token)

  // "twenty-five"
  if (token.includes('-')) {
    const parts = token.split('-').filter(Boolean)
    if (parts.length === 2 && parts.every((p) => p in WORD_NUMBERS)) {
      return WORD_NUMBERS[parts[0]] + WORD_NUMBERS[parts[1]]
    }
  }

  if (token in WORD_NUMBERS) return WORD_NUMBERS[token]
  if (token in WORD_FRACTIONS) return WORD_FRACTIONS[token]
  return null
}

const RANGE_SEPARATOR = /^(?:-|–|—|to|or)$/

/**
 * Reads a quantity off the front of a token list.
 * Handles "1 1/2", "one and a half", "2 to 3", "a couple of".
 */
export function parseLeadingQuantity(tokens: string[]): QuantityMatch | null {
  if (tokens.length === 0) return null

  let index = 0
  const first = parseNumericToken(tokens[0])
  if (first === null) return null

  let value = first
  const displayParts: string[] = [tokens[0]]
  index = 1

  // Mixed number: "1 1/2", "1 ½", "two and a half"
  if (index < tokens.length && Number.isInteger(value)) {
    const nextFraction = parseNumericToken(tokens[index])
    const nextIsFraction =
      nextFraction !== null && nextFraction > 0 && nextFraction < 1
    if (nextIsFraction) {
      value += nextFraction
      displayParts.push(tokens[index])
      index += 1
    } else if (tokens[index] === 'and') {
      // "one and a half", "two and a quarter"
      const rest = tokens.slice(index + 1)
      const offset = rest[0] === 'a' || rest[0] === 'an' ? 1 : 0
      const word = rest[offset]
      if (word && word in WORD_FRACTIONS) {
        value += WORD_FRACTIONS[word]
        displayParts.push('and', ...rest.slice(0, offset + 1))
        index += offset + 2
      }
    }
  }

  // Range: "2 to 3 cups", "2-3"
  let isRange = false
  if (index < tokens.length && RANGE_SEPARATOR.test(tokens[index])) {
    const upper = parseNumericToken(tokens[index + 1] ?? '')
    if (upper !== null && upper > value) {
      isRange = true
      displayParts.push('-', tokens[index + 1])
      index += 2
    }
  }

  // "a couple of", "a dozen" — swallow the filler "of"
  if (tokens[index] === 'of' && (value === 2 || value === 3 || value === 12)) {
    index += 1
  }

  const display = isRange
    ? `${formatQuantity(value)}-${displayParts[displayParts.length - 1]}`
    : formatQuantity(value)

  return { value, display, consumed: index, isRange }
}

/** Splits a compact "2-3" token so the range logic above can see both halves. */
export function expandRangeTokens(tokens: string[]): string[] {
  const out: string[] = []
  for (const token of tokens) {
    const m = /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/.exec(token)
    if (m) out.push(m[1], '-', m[2])
    else out.push(token)
  }
  return out
}

const FRACTION_DENOMINATORS = [2, 3, 4, 8, 16]

/**
 * 0.5 -> "1/2", 2.5 -> "2 1/2", 0.3333 -> "1/3", 1.07 -> "1.1".
 * Keeps scaled quantities readable instead of "0.6666666666666666".
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''

  const whole = Math.floor(value + 1e-9)
  const fraction = value - whole

  if (fraction < 0.02) return String(whole)
  if (fraction > 0.98) return String(whole + 1)

  let best: { numerator: number; denominator: number } | null = null
  let bestError = 0.035
  for (const denominator of FRACTION_DENOMINATORS) {
    const numerator = Math.round(fraction * denominator)
    if (numerator <= 0 || numerator >= denominator) continue
    // Skip fractions that reduce (4/8 should render as 1/2, found at d=2 already)
    if (gcd(numerator, denominator) !== 1) continue
    const error = Math.abs(fraction - numerator / denominator)
    if (error < bestError) {
      bestError = error
      best = { numerator, denominator }
    }
  }

  if (best) {
    const frac = `${best.numerator}/${best.denominator}`
    return whole > 0 ? `${whole} ${frac}` : frac
  }

  const rounded = Math.round(value * 10) / 10
  return String(rounded)
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
