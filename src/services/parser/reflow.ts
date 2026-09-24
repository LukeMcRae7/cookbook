/**
 * Puts structure back into text that lost its newlines.
 *
 * TikTok's oEmbed endpoint — the only way to read a caption from a link — joins
 * every line with a space, so a written recipe arrives as
 *   "…Pasta: Ingredients Chicken 2 chicken breasts 1 tbsp olive oil … Instructions Season…"
 * or, with no headings at all, as
 *   "Recipe 1 1/2 cups flour 1 cup sugar … 1 cup water Bake for 45 minutes at 175C."
 * These functions recover the headings, the ingredient boundaries and the steps.
 * They only fire on shapes that ordinary line-broken text never has.
 */

import { canonicalUnit } from './units'
import { COOKING_VERBS, FOOD_KEYWORDS, PREP_WORDS } from './vocabulary'
import { hasImperativeClause, isNoise, splitSentences, startsWithCookingVerb } from './directionParser'
import { classifyHeading } from './sections'

/** A single line this long that contains a capitalised heading word is flattened. */
const FLATTENED_LINE_LENGTH = 120

/** "Ingredients" -> "Ingredients|ingredients|INGREDIENTS" for a case-aware pattern. */
function casings(...words: string[]): string {
  return words
    .flatMap((word) => [word.charAt(0).toUpperCase() + word.slice(1), word, word.toUpperCase()])
    .join('|')
}

/** Words that qualify a heading: "REHEAT INSTRUCTIONS", "Sauce Ingredients". */
const HEADING_QUALIFIER = casings(
  'reheat', 'reheating', 'cooking', 'baking', 'assembly', 'prep', 'serving',
  'freezing', 'storage', 'sauce', 'dressing', 'marinade', 'topping', 'filling', 'recipe',
)

const INLINE_HEADING = new RegExp(
  String.raw`(^|[\s:.!?)])` +
    String.raw`((?:(?:${HEADING_QUALIFIER})\s+)?(?:Step[-\s]?by[-\s]?Step\s+)?` +
    String.raw`(?:INGREDIENTS?|Ingredients?|INSTRUCTIONS?|Instructions?|DIRECTIONS?|Directions?|METHOD|Method|STEPS|Steps|NOTES|Notes|TIPS|Tips)` +
    String.raw`(?:\s*\([^)]{1,40}\))?\s*:?)` +
    // Only when content follows: after a colon anything counts ("Ingredients:
    // kosher salt"); without one, a capital, digit, fraction or bullet must.
    String.raw`(?=(?<=:)\s+\S|\s+[A-Z0-9½¼¾⅓⅔⅛•\-*~])`,
  'g',
)

/** Breaks a flattened line at the section headings buried inside it. */
export function reflowInlineHeadings(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line.length >= FLATTENED_LINE_LENGTH
        ? line.replace(INLINE_HEADING, (_match, lead: string, heading: string) => `${lead}\n${heading.trim()}\n`)
        : line,
    )
    .join('\n')
}

// ---------------------------------------------------------------------------
// Quantities
// ---------------------------------------------------------------------------

const NUMBER_TOKEN =
  /^[~≈]?(?:\d+(?:[.,]\d+)?(?:\/\d+)?(?:[–—-]\d+(?:[.,/]\d+)?)?|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+[½⅓⅔¼¾⅛⅜⅝⅞])$/

/** "8oz", "200g", "1tspn", "100-150ml" — a number with its unit glued on. */
const GLUED_QUANTITY = /^[~≈]?\d+(?:[.,/]\d+)?(?:[–—-]\d+(?:[.,/]\d+)?)?([a-zA-Z]+)\.?$/

/** Does this token begin an ingredient: "2", "1/2", "1–2", "½", "8oz", "200g"? */
export function isQuantityToken(token: string): boolean {
  if (NUMBER_TOKEN.test(token)) return true
  const glued = GLUED_QUANTITY.exec(token)
  return glued !== null && canonicalUnit(glued[1]) !== null
}

const QUANTITY_TOKEN = { test: isQuantityToken }

/** Words that join numbers into one quantity: "2 to 3", "1 or 2", "2 x". */
const QUANTITY_JOINERS = new Set(['to', 'or', '-', '–', '—', 'x', 'and', 'of'])

/** Amounts written without a number: "handful fresh basil", "pinch of salt". */
const SOFT_UNITS = new Set(['handful', 'pinch', 'dash', 'splash', 'bunch', 'sprig', 'drizzle', 'knob'])
const SIZE_WORDS = new Set(['a', 'an', 'of', 'small', 'large', 'big', 'tiny', 'generous', 'good', 'heaping', 'one'])

/**
 * Adjectives that can sit in front of a capitalised word *inside* one
 * ingredient: "2 tsp dried Italian seasoning", "1/2 cup grated Parmesan".
 */
const ADJECTIVES_BEFORE_PROPER = new Set([
  ...PREP_WORDS,
  'dried', 'smoked', 'sweet', 'fresh', 'ground', 'sharp', 'mild', 'hot',
  'extra', 'virgin', 'light', 'dark', 'whole', 'plain', 'unsalted', 'salted',
  'large', 'small', 'medium', 'boneless', 'skinless', 'frozen', 'canned',
  'of', 'and', 'or', 'with', 'in', 'a', 'the', 'your', 'some', 'good', 'real',
])

/**
 * Nouns that complete a two-word Title Case ingredient ("Olive Oil", "Sesame
 * Seeds", "Garlic Salt"), so a capitalised food word before them is not the
 * end of the previous item.
 */
const HEAD_NOUNS = new Set([
  'oil', 'powder', 'sauce', 'seeds', 'seed', 'milk', 'cream', 'cheese', 'flakes',
  'paste', 'juice', 'zest', 'leaves', 'leaf', 'sugar', 'flour', 'butter', 'stock',
  'broth', 'vinegar', 'syrup', 'extract', 'seasoning', 'salt', 'pepper', 'beans',
  'noodles', 'bread', 'crumbs', 'chips', 'breast', 'breasts', 'thighs', 'wings',
  'rice', 'sticks', 'cubes', 'water', 'wine', 'mix', 'spice', 'spices', 'yogurt',
])

function parenDelta(token: string): number {
  return (token.match(/\(/g) ?? []).length - (token.match(/\)/g) ?? []).length
}

/** How many ingredients' worth of amounts a piece of text holds ("1/2" is one). */
export function quantityStartCount(text: string): number {
  return countQuantityStarts(text.split(/\s+/).filter(Boolean))
}

function countQuantityStarts(tokens: string[]): number {
  let depth = 0
  let count = 0
  tokens.forEach((token, index) => {
    if (depth === 0 && QUANTITY_TOKEN.test(token)) {
      const previous = tokens[index - 1]
      if (!previous || !(QUANTITY_TOKEN.test(previous) || QUANTITY_JOINERS.has(previous.toLowerCase()))) {
        count += 1
      }
    }
    depth = Math.max(0, depth + parenDelta(token))
  })
  return count
}

/**
 * True when one line is carrying several ingredients separated only by spaces:
 * more quantities than its commas could account for, or several items run
 * together with no quantities at all ("Rice Quick pickled cucumbers Edamame").
 */
export function isRunOnIngredientLine(line: string): boolean {
  const tokens = line.split(/\s+/).filter(Boolean)
  const quantities = countQuantityStarts(tokens)
  const commas = (line.replace(/\([^)]*\)/g, '').match(/,/g) ?? []).length
  if (quantities >= 2 && quantities > commas + 1) return true
  return !looksLikeProse(line) && splitRunOnIngredients(line).length >= 3
}

/**
 * "Chicken 2 chicken breasts 1 tbsp olive oil Salt and pepper, to taste"
 * -> ["Chicken", "2 chicken breasts", "1 tbsp olive oil", "Salt and pepper, to taste"]
 *
 * Splits before every quantity; before a capitalised word that follows a
 * lowercase word which could end an ingredient (never after a unit, and never
 * after an adjective leading into a proper noun); before a number-less amount
 * ("…coconut milk handful fresh basil"); and between capitalised food words in
 * an unquantified run ("Salt Thyme Feta") unless they form one name ("Olive Oil").
 */
export function splitRunOnIngredients(line: string): string[] {
  const tokens = line.split(/\s+/).filter(Boolean)
  const segments: string[][] = []
  let current: string[] = []
  let depth = 0

  tokens.forEach((token, index) => {
    const previous = tokens[index - 1]
    let boundary = false

    if (depth === 0 && previous !== undefined && current.length > 0) {
      const previousWord = previous.replace(/[,.;:)*†]+$/, '').toLowerCase()
      const bareToken = token.replace(/[,.;:*†]+$/, '').toLowerCase()
      const segmentHasQuantity = current.some((word) => QUANTITY_TOKEN.test(word))

      // "1 lb 8oz", "1 cup 2 tbsp": a compound amount, still one ingredient.
      const compoundAmount =
        current.length === 2 && QUANTITY_TOKEN.test(current[0]) && canonicalUnit(previousWord) !== null

      // "…cheese, or more as needed freshly cracked pepper": a closing phrase
      // ends the item even when the next one starts lowercase.
      const closingPhrase =
        current.length >= 3 &&
        (/^(?:to taste|as needed|as desired|if desired|if needed)$/.test(`${tokens[index - 2] ?? ''} ${previousWord}`.toLowerCase()) ||
          /^(?:divided|optional)$/.test(previousWord))

      if (QUANTITY_TOKEN.test(token)) {
        boundary = !(QUANTITY_TOKEN.test(previous) || QUANTITY_JOINERS.has(previousWord) || compoundAmount)
      } else if (closingPhrase && /^[a-z]/.test(token)) {
        boundary = true
      } else if (SOFT_UNITS.has(bareToken) && /^[a-z]/.test(previous)) {
        boundary = !SIZE_WORDS.has(previousWord) && !QUANTITY_TOKEN.test(previous)
      } else if (/^[A-Z]/.test(token) && /^(?:[a-z][a-z'’-]*[,.;:)*†]*|\))$/.test(previous)) {
        // (A footnote marker, "starch*", also ends an item.)
        const segmentHasComma = current.some((word) => word.includes(','))
        const isUnit = canonicalUnit(previousWord) !== null
        const leadsIntoName = ADJECTIVES_BEFORE_PROPER.has(previousWord) && !segmentHasComma
        boundary = !isUnit && !leadsIntoName
      } else if (
        /^[A-Z]/.test(token) &&
        /^[A-Z][a-z'’-]+$/.test(previous) &&
        !segmentHasQuantity &&
        (FOOD_KEYWORDS.has(previousWord) || FOOD_KEYWORDS.has(previousWord.replace(/s$/, ''))) &&
        !HEAD_NOUNS.has(bareToken)
      ) {
        boundary = true
      }
    }

    if (boundary) {
      segments.push(current)
      current = []
    }
    current.push(token)
    depth = Math.max(0, depth + parenDelta(token))
  })

  if (current.length) segments.push(current)
  return segments.map((segment) => segment.join(' ').trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Bullets, group labels and footnotes
// ---------------------------------------------------------------------------

// Spaced bullets (" - ", " • "), a bare "•", and a dash glued to a lowercase
// word (" -cube salmon") — TikTok captions use all three.
const BULLET_SEPARATOR = /\s[-–—•*·▪►✓✔](?=\s)|•|\s-(?=[a-z])/g

/** Every bullet position in a line that is not inside parentheses. */
function bulletPositions(line: string): { index: number; length: number }[] {
  const positions: { index: number; length: number }[] = []
  for (const match of line.matchAll(BULLET_SEPARATOR)) {
    const index = match.index ?? 0
    // "3 – 4 tbsp" is a range, not a bullet.
    if (/\d\s*$/.test(line.slice(0, index)) && /^\s*[-–—]\s*\d/.test(line.slice(index))) continue
    const before = line.slice(0, index)
    const depth = (before.match(/\(/g) ?? []).length - (before.match(/\)/g) ?? []).length
    if (depth <= 0) positions.push({ index, length: match[0].length })
  }
  return positions
}

function isTitlePhrase(text: string): boolean {
  const words = text.split(/\s+/).filter((word) => /[a-z]/i.test(word))
  return words.length > 0 && words.length <= 3 && !/\d/.test(text) && words.every((word) => /^[A-Z]/.test(word))
}

/**
 * "- 4 chicken breasts - 1 tsp paprika - salt & pepper Sauce - 2 garlic cloves"
 * -> ["4 chicken breasts", "1 tsp paprika", "salt & pepper", "Sauce:", "2 garlic cloves"]
 *
 * Splits a flattened bulleted list at its bullets (never inside parentheses),
 * and turns a Title Case word left dangling at the end of an item — the next
 * group's heading — into a label line.
 */
export function splitAtInlineBullets(line: string): string[] {
  const positions = bulletPositions(line)
  if (positions.length < 2) return [line]

  const pieces: string[] = []
  let start = 0
  for (const { index, length } of positions) {
    pieces.push(line.slice(start, index))
    start = index + length
  }
  pieces.push(line.slice(start))

  const out: string[] = []
  const items = pieces.map((piece) => piece.trim()).filter(Boolean)
  items.forEach((item, index) => {
    const parts = splitRunOnIngredients(item)
    const tail = parts[parts.length - 1]
    if (index < items.length - 1 && parts.length >= 2 && isTitlePhrase(tail)) {
      out.push(parts.slice(0, -1).join(' '), `${tail}:`)
    } else {
      out.push(item)
    }
  })
  return out
}

/**
 * "…etc) Season with: salt, garlic… Spicy mayo: 90g light mayo…" — a flattened
 * list whose sub-groups are introduced by a capitalised label and a colon.
 * Splits before each label; the label stays at the front of its piece.
 */
export function splitAtGroupLabels(line: string): string[] {
  return line
    .split(/(?<=\s)(?=[A-Z][A-Za-z&'’ -]{1,28}:\s)/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export interface FootnoteSplit {
  text: string
  notes: string[]
}

/**
 * "*The reason I use a combo of…" — an asterisk that opens a word starts a
 * footnote (one glued to the end of a word, "starch*", only marks one). The
 * footnote runs to the end of the piece, or to a sentence end that is followed
 * by another quantity.
 */
export function extractFootnotes(piece: string): FootnoteSplit {
  const notes: string[] = []
  let text = piece
  for (let guard = 0; guard < 5; guard += 1) {
    const start = /(?:^|\s)\*(?=[A-Za-z])/.exec(text)
    if (!start) break
    const from = start.index + start[0].length
    const rest = text.slice(from)
    const end = /[.!?](?=\s+(?:[~≈]?\d|[½¼¾⅓⅔]))/.exec(rest)
    const note = end ? rest.slice(0, end.index + 1) : rest
    notes.push(note.trim())
    text = `${text.slice(0, start.index)} ${end ? rest.slice(end.index + 1) : ''}`.trim()
  }
  return { text, notes }
}

const FUNCTION_WORDS = new Set([
  'is', 'are', 'was', 'were', 'will', 'would', 'because', 'though', 'although',
  'if', 'you', 'your', 'i', 'my', 'this', 'that', 'it', 'its', "it's", 'but',
  'so', 'just', 'still', 'tends', 'can', 'should', 'we', 'our', 'they', 'which',
])

/** A sentence someone wrote, not a line on an ingredient list. */
export function looksLikeProse(text: string): boolean {
  const words = text.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length < 7) return false
  const functionWords = words.filter((word) => FUNCTION_WORDS.has(word)).length
  return functionWords >= 2 || (words.length >= 12 && /[.!?]$/.test(text.trim()))
}

// ---------------------------------------------------------------------------
// Headings the author never wrote
// ---------------------------------------------------------------------------

/** Words that follow an instruction verb: "Bake for", "Put it", "Blend all". */
const DIRECTION_FOLLOWERS = new Set([
  'the', 'a', 'an', 'it', 'them', 'all', 'everything', 'your', 'in', 'into',
  'for', 'at', 'on', 'until', 'and', 'with', 'to', 'over', 'up', 'together',
  'off', 'out', 'this', 'these', 'that', 'both', 'half', 'each', 'some', 'well',
  'immediately', 'gently', 'remaining', 'on', 'onto',
])

/** Is tokens[index] the start of an instruction: "Bake for", "Put it in"? */
function startsInstruction(tokens: string[], index: number): boolean {
  const token = tokens[index]
  if (!/^[A-Z][a-z]+$/.test(token)) return false
  if (!COOKING_VERBS.has(token.toLowerCase())) return false
  const next = tokens[index + 1]?.toLowerCase().replace(/[,.;:]+$/, '')
  return next !== undefined && DIRECTION_FOLLOWERS.has(next)
}

/** "1." markers that count up in order — a numbered method. */
function numberedStepStarts(tokens: string[]): number[] {
  const starts: number[] = []
  let expected = 1
  tokens.forEach((token, index) => {
    const match = /^(?:step)?(\d{1,2})[.)]$/i.exec(token)
    if (!match) return
    const number = Number(match[1])
    const next = tokens[index + 1]
    // The count-up requirement is what makes this safe, so "2. remove skin…"
    // (lowercase) still counts once "1." has been seen.
    const startsWord = next && (/^[A-Z]/.test(next) || (starts.length > 0 && /^[a-z]/.test(next)))
    if (startsWord && (number === expected || (starts.length === 0 && number === 1))) {
      starts.push(index)
      expected = number + 1
    }
  })
  return starts.length >= 2 ? starts : []
}

/**
 * Captions that never say "Ingredients" or "Instructions" still have both.
 * An ingredient list is a dense run of quantities; the method starts at the
 * first instruction verb (or numbered step) after it. Inserts the missing
 * headings so the block parser can do the rest.
 */
export function inferMissingHeadings(text: string): string {
  const lines = text.split('\n')
  let hasIngredients = lines.some((line) => classifyHeading(line) === 'ingredients')
  let hasDirections = lines.some((line) => classifyHeading(line) === 'directions')
  if (hasIngredients && hasDirections) return text

  const out: string[] = []
  let inIngredients = false

  for (const line of lines) {
    const kind = classifyHeading(line)
    if (kind) {
      inIngredients = kind === 'ingredients'
      out.push(line)
      continue
    }
    if (line.length < 60) {
      out.push(line)
      continue
    }

    const tokens = line.split(/\s+/).filter(Boolean)
    const inserts = new Map<number, string>()
    let searchFrom = 0

    if (!hasIngredients && !inIngredients) {
      const start = denseQuantityStart(tokens)
      if (start !== -1) {
        let at = start
        // Keep a group label that introduces the list with it ("Salmon: 1 lb…").
        if (/:$/.test(tokens[start - 1] ?? '')) {
          at = start - 1
          while (at > 0 && start - at < 3 && /^[A-Z&]/.test(tokens[at - 1])) at -= 1
        }
        // …or a label that sits on its own line just above.
        if (at === 0 && /^[^:]{1,40}:$/.test(out[out.length - 1] ?? '')) {
          out.splice(out.length - 1, 0, 'Ingredients')
        } else {
          inserts.set(at, 'Ingredients')
        }
        hasIngredients = true
        inIngredients = true
        searchFrom = start + 1
      }
    }

    if (!hasDirections && inIngredients) {
      const numbered = numberedStepStarts(tokens.slice(searchFrom)).map((index) => index + searchFrom)
      let start = numbered[0] ?? -1
      for (let index = Math.max(searchFrom, 1); index < tokens.length; index += 1) {
        if (start !== -1 && index >= start) break
        if (startsInstruction(tokens, index)) {
          start = index
          break
        }
      }
      if (start !== -1) {
        inserts.set(start, 'Instructions')
        hasDirections = true
        inIngredients = false
      }
    }

    if (inserts.size === 0) {
      out.push(line)
      continue
    }
    let current: string[] = []
    tokens.forEach((token, index) => {
      const heading = inserts.get(index)
      if (heading) {
        if (current.length) out.push(current.join(' '))
        out.push(heading)
        current = []
      }
      current.push(token)
    })
    if (current.length) out.push(current.join(' '))
  }

  return out.join('\n')
}

/** The first quantity that begins a run of at least three within ~30 words. */
function denseQuantityStart(tokens: string[]): number {
  const starts: number[] = []
  let depth = 0
  tokens.forEach((token, index) => {
    if (depth === 0 && QUANTITY_TOKEN.test(token)) {
      const previous = tokens[index - 1]
      if (!previous || !(QUANTITY_TOKEN.test(previous) || QUANTITY_JOINERS.has(previous.toLowerCase()))) {
        starts.push(index)
      }
    }
    depth = Math.max(0, depth + parenDelta(token))
  })
  for (let i = 0; i + 2 < starts.length; i += 1) {
    if (starts[i + 2] - starts[i] <= 30) return starts[i]
  }
  return -1
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

/** "Cook the chicken:" labels a step; "For the Cake:" / "Salmon preparation:" a section. */
function isStepLabel(label: string): boolean {
  return startsWithCookingVerb(label)
}

/**
 * Within one sentence with no full stops between steps ("…until soft Chop the
 * carrots…"), a capitalised instruction verb after a complete instruction
 * starts the next step.
 */
function splitAtRunOnVerbs(sentence: string): string[] {
  const tokens = sentence.split(/\s+/).filter(Boolean)
  const parts: string[] = []
  let current: string[] = []
  tokens.forEach((token, index) => {
    // After a complete instruction, any capitalised verb followed by a
    // lowercase word begins the next one: "…until soft) Chop carrot and swede…"
    const verbStartsHere =
      /^[A-Z][a-z]+$/.test(token) &&
      COOKING_VERBS.has(token.toLowerCase()) &&
      /^[a-z]/.test(tokens[index + 1] ?? '')
    if (
      current.length >= 3 &&
      /[a-z)]$/.test(tokens[index - 1] ?? '') &&
      verbStartsHere &&
      hasImperativeClause(current.join(' '))
    ) {
      parts.push(current.join(' '))
      current = []
    }
    current.push(token)
  })
  if (current.length) parts.push(current.join(' '))
  return parts
}

/** A method paragraph with no markers: one step per instruction sentence. */
function stepsFromSentences(paragraph: string): string[] {
  const steps: string[] = []
  for (const sentence of splitSentences(paragraph).flatMap(splitAtRunOnVerbs)) {
    if (isNoise(sentence)) continue
    if (steps.length === 0 || hasImperativeClause(sentence)) steps.push(sentence)
    else steps[steps.length - 1] = `${steps[steps.length - 1]} ${sentence}`
  }
  return steps
}

/** Splits at numbered markers that count up: "…through 2. Dice your veggies…" */
function stepsFromNumbers(paragraph: string): string[] | undefined {
  const tokens = paragraph.split(/\s+/).filter(Boolean)
  const starts = numberedStepStarts(tokens)
  if (starts.length < 2) return undefined
  const steps: string[] = []
  const bounds = [...starts, tokens.length]
  if (starts[0] > 0) steps.push(tokens.slice(0, starts[0]).join(' '))
  for (let i = 0; i < starts.length; i += 1) steps.push(tokens.slice(bounds[i], bounds[i + 1]).join(' '))
  return steps.filter((step) => step.trim())
}

/**
 * A flattened instruction paragraph -> one line per step, with section labels
 * ("For the Cake:") as their own lines. Prefers the author's own markers —
 * sections, bullets, numbers — and otherwise starts a step at each instruction.
 */
export function splitRunOnDirections(paragraph: string): string[] {
  const out: string[] = []

  for (const piece of splitAtGroupLabels(paragraph)) {
    const label = /^([A-Z][^:]{1,40}):\s+/.exec(piece)
    let body = piece
    if (label) {
      if (isStepLabel(label[1])) {
        // "Cook the chicken: Heat a large pot…" is one step, as the author wrote it.
        out.push(piece.trim())
        continue
      }
      out.push(`${label[1].trim()}:`)
      body = piece.slice(label[0].length)
    }

    const bullets = splitAtInlineBullets(body)
    if (bullets.length >= 2) {
      out.push(...bullets.map((bullet) => bullet.trim()).filter((bullet) => bullet && !isNoise(bullet)))
      continue
    }
    out.push(...(stepsFromNumbers(body) ?? stepsFromSentences(body)))
  }

  return out.filter(Boolean)
}
