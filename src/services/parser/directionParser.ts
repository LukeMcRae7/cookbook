import type { Direction, Temperature, TemperatureUnit } from '../../types/recipe'
import { parseNumericToken } from './numberParser'
import { COOKING_VERBS, NOISE_PATTERNS } from './vocabulary'

let idCounter = 0
export function nextDirectionId(): string {
  idCounter += 1
  return `dir-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

/** Stand-ins for periods that must not end a sentence; restored after the split. */
const DOT_GUARD = '\u0001'
const DECIMAL_GUARD = '\u0002'

const ABBREVIATIONS = /\b(mr|mrs|ms|dr|approx|oz|lb|tbsp|tsp|no)\.\s/gi

/** Sentence split that survives decimals ("350.5") and abbreviations. */
export function splitSentences(text: string): string[] {
  const guarded = text
    .replace(ABBREVIATIONS, (match) => match.replace('.', DOT_GUARD))
    .replace(/(\d)\.(\d)/g, `$1${DECIMAL_GUARD}$2`)

  return guarded
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) =>
      sentence.split(DOT_GUARD).join('.').split(DECIMAL_GUARD).join('.').trim(),
    )
    .filter(Boolean)
}

// Mixed numbers come first so "1 1/2 hours" is read whole, not as "1/2 hours".
const DURATION_AMOUNT = String.raw`(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?[½¼¾⅓⅔]?|[½¼¾⅓⅔]|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|forty-five|sixty|half)`
const DURATION_PATTERN = new RegExp(
  String.raw`\b${DURATION_AMOUNT}\s*(?:(?:-|–|—|to|or)\s*(\d+(?:\.\d+)?))?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b`,
  'i',
)
/** The minutes that follow an hour: "1 hour 30 minutes", "1 hr and 15 min". */
const DURATION_TAIL = /^\s*(?:and\s+)?(\d+)\s*(minutes?|mins?)\b/i

function parseDurationAmount(raw: string): number | null {
  if (raw.toLowerCase() === 'half') return 0.5
  const parts = raw.trim().split(/\s+/)
  let total = 0
  for (const part of parts) {
    const value = parseNumericToken(part)
    if (value === null) return null
    total += value
  }
  return total
}

const UNIT_SECONDS: Record<string, number> = {
  second: 1, seconds: 1, sec: 1, secs: 1,
  minute: 60, minutes: 60, min: 60, mins: 60,
  hour: 3600, hours: 3600, hr: 3600, hrs: 3600,
}

export interface DurationMatch {
  seconds: number
  text: string
}

/**
 * "25 minutes" -> 1500s. For a range the lower bound wins so a timer never
 * runs past the point food is done.
 */
export function extractDuration(text: string): DurationMatch | null {
  if (/\bhalf\s+an?\s+hour\b/i.test(text)) {
    return { seconds: 1800, text: 'half an hour' }
  }

  const match = DURATION_PATTERN.exec(text)
  if (!match) return null

  const [full, rawAmount, , rawUnit] = match
  const amount = parseDurationAmount(rawAmount)
  if (amount === null || amount <= 0) return null

  const unitKey = rawUnit.toLowerCase()
  const multiplier = UNIT_SECONDS[unitKey] ?? UNIT_SECONDS[unitKey.replace(/s$/, '')]
  if (!multiplier) return null

  let seconds = Math.round(amount * multiplier)
  let matched = full

  if (multiplier === 3600) {
    const rest = text.slice((match.index ?? 0) + full.length)
    const tail = DURATION_TAIL.exec(rest)
    if (tail) {
      seconds += Number(tail[1]) * 60
      matched += tail[0]
    } else if (/^\s*and\s+a\s+half\b/i.test(rest)) {
      // "an hour and a half"
      seconds += 1800
    }
  }

  if (seconds < 1 || seconds > 24 * 3600) return null
  return { seconds, text: matched.trim() }
}

/**
 * Finds an oven/cooking temperature. When the speaker omits the scale we assume
 * Fahrenheit above 100° (US recipe speech) and Celsius at or below it.
 */
export function extractTemperature(text: string): Temperature | null {
  const explicit = /\b(\d{2,3})\s*(?:°\s*|\s*degrees?\s+)?(fahrenheit|celsius|centigrade|f|c)\b/i.exec(text)
  if (explicit) {
    const value = Number(explicit[1])
    const scale = explicit[2].toLowerCase()
    return { value, unit: scale.startsWith('c') ? 'C' : 'F' }
  }

  const degrees = /\b(\d{2,3})\s*(?:°|\bdegrees?\b)/i.exec(text)
  if (degrees) {
    const value = Number(degrees[1])
    if (value < 20 || value > 550) return null
    return { value, unit: value > 100 ? 'F' : 'C' }
  }

  const bare = BARE_OVEN_TEMPERATURE.exec(text)
  if (bare) {
    const value = Number(bare[2])
    return { value, unit: bareOvenScale(value) }
  }
  return null
}

/**
 * "Preheat the oven to 350" — a scale-less number after an oven verb. Nobody
 * sets an oven below 250°F, and nobody sets one above 250°C, so 250 divides
 * the two scales cleanly for oven temperatures.
 */
const BARE_OVEN_TEMPERATURE =
  /\b((?:pre-?heat(?:\s+(?:the|your))?\s+(?:oven|air\s*fryer)\s+to|(?:oven|air\s*fryer)\s+to|bake\s+(?:it\s+|them\s+)?at|roast\s+(?:it\s+|them\s+)?at|air\s*fry\s+(?:it\s+|them\s+)?at|set\s+(?:the\s+)?(?:oven|air\s*fryer)\s+(?:to|at))\s+)(\d{3})\b(?!\s*(?:°|degrees?|g\b|grams?|ml|minutes?|mins?|seconds?))/i

function bareOvenScale(value: number): TemperatureUnit {
  return value >= 250 ? 'F' : 'C'
}

/** "bake at 350 degrees" -> "bake at 350°F"; "oven to 350" -> "oven to 350°F" */
export function normaliseTemperatureText(text: string): string {
  const withBare = text.replace(
    new RegExp(BARE_OVEN_TEMPERATURE.source, 'gi'),
    (_match, lead: string, rawValue: string) =>
      `${lead}${rawValue}°${bareOvenScale(Number(rawValue))}`,
  )
  const normalised = withBare
    // "Bake at 175C" / "400 F": a scale letter with no degree sign.
    .replace(/\b(\d{3})\s?([CF])\b(?![a-z'’])/g, (match, rawValue: string, scale: string) => {
      const value = Number(rawValue)
      return value >= 100 && value <= 550 ? `${value}°${scale}` : match
    })
    .replace(
    /\b(\d{2,3})\s*(?:°|degrees?)(\s*)(fahrenheit|celsius|centigrade|f|c)?\b/gi,
    (match, rawValue: string, gap: string, rawScale?: string) => {
      const value = Number(rawValue)
      if (value < 20 || value > 550) return match
      const scale = rawScale
        ? rawScale.toLowerCase().startsWith('c')
          ? 'C'
          : 'F'
        : value > 100
          ? 'F'
          : 'C'
      // With no scale spoken, `gap` is the space that separated "degrees" from
      // the next word — keep it so words do not run together.
      return `${value}°${scale}${rawScale ? '' : gap}`
    },
  )
  // "375°F (air fry) or 425 (oven)" — an alternative setting shares the scale.
  return normalised.replace(
    /(\d{3})°([FC])((?:\s*\([^)]{1,20}\))?\s+or\s+)(\d{3})\b(?!\s*°)/g,
    (_match, first: string, scale: string, joiner: string, second: string) =>
      `${first}°${scale}${joiner}${second}°${scale}`,
  )
}

const LEADING_CONNECTORS = /^(?:and|then|and\s+then|so|but|next|after\s+that|ok(?:ay)?|alright|now|also|plus|finally)[,\s]+/i

export function isNoise(sentence: string): boolean {
  const trimmed = sentence.trim()
  if (trimmed.length < 3) return true
  return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function firstWord(sentence: string): string {
  const cleaned = sentence.replace(LEADING_CONNECTORS, '').trim()
  const word = cleaned.split(/[\s,]+/)[0] ?? ''
  return word.toLowerCase().replace(/[^a-zà-ÿ-]/g, '')
}

/** Does this sentence start with an imperative cooking verb? */
export function startsWithCookingVerb(sentence: string): boolean {
  return COOKING_VERBS.has(firstWord(sentence))
}

/** Looser test: a cooking verb anywhere in the sentence. */
export function containsCookingVerb(sentence: string): boolean {
  return sentence
    .toLowerCase()
    .split(/[^a-zà-ÿ-]+/)
    .some((word) => COOKING_VERBS.has(word))
}

const CLAUSE_SPLIT =
  /[,;:]|\s+(?:and\s+then|then|but|so\s+that|while|until|once|after|before|when)\s+/i

/**
 * Does any clause *begin* with a cooking verb — the shape of an instruction?
 *
 * Plain "contains a cooking verb" is far too loose, because many cooking verbs
 * are also ordinary nouns: "chicken wrap", "sour cream", "a dice of onion".
 * A descriptive sentence like "this chicken wrap is an excellent choice" trips
 * that test; it does not trip this one.
 */
export function hasImperativeClause(sentence: string): boolean {
  const clauseStarts = sentence
    .split(CLAUSE_SPLIT)
    .some(
      (clause) =>
        startsWithCookingVerb(clause) && clause.trim().split(/\s+/).length >= 2,
    )
  if (clauseStarts) return true
  // Flattened captions drop the punctuation between clauses, but keep the
  // capital: "After they're both cooked Combine all the ingredients…"
  return sentence
    .split(/\s+/)
    .some(
      (word, index, words) =>
        index > 0 &&
        /^[A-Z][a-z]+$/.test(word) &&
        COOKING_VERBS.has(word.toLowerCase()) &&
        !NOUN_LIKE_VERBS.has(word.toLowerCase()) &&
        /^[a-z]/.test(words[index + 1] ?? ''),
    )
}

/** Verbs that, capitalised mid-sentence, are usually part of a name ("Brown sugar"). */
const NOUN_LIKE_VERBS = new Set([
  'brown', 'cream', 'top', 'dry', 'roll', 'line', 'pipe', 'score', 'cube',
  'core', 'smoke', 'thread', 'press', 'rest', 'set', 'mash', 'mince', 'toast',
])

/**
 * "Mix everything together and bake at 350 degrees for 25 minutes."
 * -> two clauses, because "bake" starts a new instruction.
 */
export function splitInstructionClauses(sentence: string): string[] {
  const parts = sentence.split(/\s*,?\s+(?:and\s+then|then|and)\s+/i)
  if (parts.length < 2) return [sentence]

  const clauses: string[] = [parts[0]]
  for (let i = 1; i < parts.length; i += 1) {
    const clause = parts[i]
    if (startsWithCookingVerb(clause) && clause.split(/\s+/).length >= 2) {
      clauses.push(clause)
    } else {
      clauses[clauses.length - 1] = `${clauses[clauses.length - 1]} and ${clause}`
    }
  }
  return clauses
}

/** "Step 3:", "Step 3 -", "3." — numbering the list itself already provides. */
const STEP_PREFIX = /^(?:step\s*)?\d{1,2}(?:[.)]|\s*:|\s+[-–])\s+|^step\s*\d{1,2}\s+/i

export function tidyDirectionText(text: string): string {
  let result = text.trim().replace(STEP_PREFIX, '').replace(LEADING_CONNECTORS, '').trim()
  result = normaliseTemperatureText(result)
  result = result
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    // "…drizzle your sauce and enjoy!" / "Top with fruit Enjoy!" — a sign-off, not a step.
    .replace(/(?:[,\s]+and)?[,.!\s]+enjoy\b[!.]*\s*$/i, '')
    .replace(/[,;:\s]+$/, '')
  if (!result) return result
  result = result.charAt(0).toUpperCase() + result.slice(1)
  if (!/[.!?]$/.test(result)) result += '.'
  return result
}

/** Builds a numbered step, attaching any timer and temperature it mentions. */
export function createDirection(text: string, step: number): Direction {
  const tidied = tidyDirectionText(text)
  const duration = extractDuration(text)
  const temperature = extractTemperature(text)

  return {
    id: nextDirectionId(),
    step,
    text: tidied,
    timerSeconds: duration?.seconds,
    temperature: temperature ?? undefined,
  }
}

export function renumberDirections(directions: Direction[]): Direction[] {
  return directions.map((direction, index) => ({ ...direction, step: index + 1 }))
}

export function formatTemperature(temperature: Temperature): string {
  return `${Math.round(temperature.value)}°${temperature.unit}`
}
