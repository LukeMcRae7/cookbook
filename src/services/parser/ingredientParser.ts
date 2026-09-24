import type { Ingredient } from '../../types/recipe'
import {
  expandRangeTokens,
  formatQuantity,
  parseLeadingQuantity,
} from './numberParser'
import { canonicalUnit, matchUnit } from './units'
import {
  FOOD_KEYWORDS,
  HEDGE_WORDS,
  LEADING_PREP_WORDS,
  NON_INGREDIENT_WORDS,
  PREP_ADVERBS,
  PREP_WORDS,
} from './vocabulary'

let idCounter = 0
/** Deterministic ids keep test snapshots stable; uniqueness is per-session. */
export function nextIngredientId(): string {
  idCounter += 1
  return `ing-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

const LEADING_FILLER = /^(?:of|the|some|a\s+little|a\s+bit\s+of|a\s+touch\s+of|your|my|any)\s+/i

/**
 * List markers from captions and recipe cards: hyphens, bullets, the "▢"
 * checkboxes WordPress recipe plugins put in front of every ingredient, ticks.
 */
export const BULLET = /^[-–—*•●◦▪▫■□▢☐✓✔➤►]\s*/

const PACKAGE_SIZE =
  /^((?:\d+|one|two|three|four|a|an)\s+)(\d+(?:\.\d+)?)\s*-?\s*(ounces?|oz\.?|pounds?|lbs?\.?|grams?|g|ml|inch(?:es)?)\s+(?=(?:cans?|jars?|packages?|pkgs?|packets?|bags?|box(?:es)?|bottles?|cartons?|tins?|blocks?|sticks?)\b)/i

/** A chunk after a comma can restart with a verb: "add the rice". */
const LEADING_ADD_VERB =
  /^(?:add(?:\s+in)?|mix\s+in|stir\s+in|pour\s+in|throw\s+in|toss\s+in|drop\s+in|put\s+in|sprinkle\s+in|fold\s+in|grab|take|combine)\s+/i

/**
 * Ingredient names never run into a destination or a clause, so everything from
 * "…to a sauce pan" or "…until golden" onward is instruction, not name.
 */
const NAME_TAIL =
  /\s+(?:to|into|onto|on|over|for|until|while|so|then|and\s+then|with\s+the|in\s+a|in\s+the|plus|if|as)\s+.*$/i

/**
 * "600g / 1.2 lb", "30 g / 2 tbsp", "1 cup / 240 ml" — a measure and its
 * conversion. The first measure *must* end in a unit: without that, the slash
 * in a plain fraction ("1/2 tsp") would be read as the separator.
 */
const DUAL_MEASURE =
  /^(\d[\d.\/\s½¼¾⅓⅔⅛-]*?\s*[a-z]+\.?)\s*\/\s*(\d[\d.\/½¼¾⅓⅔⅛\s-]*\s*(?:lbs?|oz|ounces?|pounds?|g|grams?|kg|ml|l|cups?|tbsp|tsp|fl\.?\s*oz)\.?)(?=\s)/i

const SIZE_WORDS = new Set(['small', 'large', 'big', 'tiny', 'generous', 'heaping', 'heaped', 'scant', 'good', 'thick', 'thin'])

/** Units that make sense with no number in front: "pinch of salt", "splash of vinegar". */
const NUMBERLESS_UNITS = new Set(['pinch', 'dash', 'splash', 'handful', 'bunch', 'sprig', 'knob', 'drop'])

/** Asides that are about the website, not the food. */
const DISCARDED_ASIDE = /^(?:\$|£|€)\s*\d|^(?:see\s+)?notes?(?:\s*\d+)?$|^note\s*\d+$|^affiliate|^\s*$/i

/**
 * Removes parentheticals, innermost first so nested ones ("minced (~1.5 tbsp)")
 * come out whole, and keeps the short ones as preparation notes.
 */
function extractAsides(text: string, asides: string[]): string {
  let result = text
  for (let pass = 0; pass < 4 && /\([^()]*\)/.test(result); pass += 1) {
    result = result.replace(/\(([^()]*)\)/g, (_match, inner: string) => {
      const aside = inner.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '')
      for (const part of aside.split(/\s*,\s*/)) {
        if (part && part.length <= 32 && !DISCARDED_ASIDE.test(part)) asides.push(part)
      }
      return ' '
    })
  }
  // An unbalanced bracket is a typo in the source, not structure.
  return result.replace(/[()]/g, ' ')
}

/**
 * "boneless, skinless chicken" and "2 large, ripe avocados": a comma between
 * adjectives is not the name/preparation boundary. Join it back up.
 */
const LIST_ADJECTIVES = new Set([
  'boneless', 'skinless', 'bone-in', 'skin-on', 'large', 'small', 'medium',
  'ripe', 'fresh', 'cold', 'warm', 'hot', 'dry', 'dried', 'raw', 'cooked',
  'firm', 'soft', 'thick', 'thin', 'lean', 'extra-large', 'organic',
  'unsalted', 'salted', 'sweet', 'mild', 'spicy', 'whole', 'heaping', 'level',
])

function joinAdjectiveCommas(text: string): string {
  let result = text
  for (let guard = 0; guard < 3; guard += 1) {
    const comma = result.indexOf(',')
    if (comma === -1) break
    const head = result
      .slice(0, comma)
      .split(/\s+/)
      .filter((word) => word && !/^[\d½¼¾⅓⅔⅛./-]+$/.test(word) && !canonicalUnit(word))
    if (head.length === 0 || !head.every((word) => LIST_ADJECTIVES.has(word.toLowerCase()))) break
    result = `${result.slice(0, comma)}${result.slice(comma + 1)}`
  }
  return result
}

function tokenize(phrase: string): string[] {
  return phrase
    .replace(/[()]/g, ' ')
    // Separate units glued directly to digits/fractions (e.g., "400g", "1.5oz", "1/2tsp")
    .replace(/([\d½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])([a-zA-Z]+)\b/g, '$1 $2')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function stripHedges(tokens: string[]): string[] {
  let start = 0
  while (start < tokens.length && HEDGE_WORDS.has(tokens[start].toLowerCase())) {
    start += 1
  }
  return tokens.slice(start)
}

function cleanEdges(text: string): string {
  return text
    .replace(/^[\s,.;:+&-]+/, '')
    .replace(/[\s,.;:+&!]+$/, '')
    .trim()
}

/** Pull "finely chopped" / "minced" off the end of a name. */
function splitTrailingPreparation(tokens: string[]): {
  name: string[]
  preparation: string[]
} {
  const name = [...tokens]
  const preparation: string[] = []

  while (name.length > 1) {
    const last = name[name.length - 1].toLowerCase().replace(/[.,]/g, '')
    if (!PREP_WORDS.has(last)) break
    let phrase = name.pop() as string
    const maybeAdverb = name[name.length - 1]?.toLowerCase()
    if (maybeAdverb && PREP_ADVERBS.has(maybeAdverb) && name.length > 1) {
      phrase = `${name.pop()} ${phrase}`
    }
    preparation.unshift(phrase)
  }

  return { name, preparation }
}

/** Pull "minced garlic" -> name "garlic", prep "minced". */
function splitLeadingPreparation(tokens: string[]): {
  name: string[]
  preparation: string[]
} {
  const name = [...tokens]
  const preparation: string[] = []

  while (name.length > 1) {
    const first = name[0].toLowerCase()
    const second = name[1]?.toLowerCase()
    if (PREP_ADVERBS.has(first) && second && PREP_WORDS.has(second)) {
      preparation.push(`${name.shift()} ${name.shift()}`)
      continue
    }
    if (LEADING_PREP_WORDS.has(first)) {
      preparation.push(name.shift() as string)
      continue
    }
    break
  }

  return { name, preparation }
}

function looksLikeFood(name: string): boolean {
  const words = name.toLowerCase().split(/[\s-]+/)
  return words.some((word) => {
    const singular = word.replace(/(es|s)$/, '')
    return FOOD_KEYWORDS.has(word) || FOOD_KEYWORDS.has(singular)
  })
}

function isRejectedName(name: string): boolean {
  if (!name) return true
  const words = name.toLowerCase().split(/\s+/)
  if (words.length > 7) return true
  if (words.every((word) => NON_INGREDIENT_WORDS.has(word))) return true
  if (NON_INGREDIENT_WORDS.has(words[0]) && words.length === 1) return true
  // Clauses, not nouns: "until golden brown", "for 10 minutes"
  if (/^(until|for|to|so|because|when|while|then|if)\b/.test(name)) return true
  if (/\b(minutes?|hours?|seconds?|degrees?)\b/.test(name)) return true
  return false
}

export interface IngredientParseOptions {
  /** Require a quantity/unit or a known food word. Off for explicit lists. */
  strict?: boolean
}

/**
 * Turns a single phrase into structured ingredient data.
 * Returns null when the phrase does not read like an ingredient.
 */
export function parseIngredientPhrase(
  phrase: string,
  options: IngredientParseOptions = {},
): Ingredient | null {
  const { strict = true } = options

  const asides: string[] = []
  let working = cleanEdges(phrase)
    .replace(BULLET, '')
    .replace(/\s+/g, ' ')
    .replace(LEADING_ADD_VERB, '')
    // "1,5 kg" is a decimal comma — convert it before commas split the phrase.
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')
    // Footnote markers: "green onions*", "flour†"
    .replace(/[*†‡]+(?=\s|,|$)/g, '')
    // "vanilla bean paste this ingredient is optional!"
    .replace(/[\s,(]+(?:this\s+(?:ingredient\s+)?is\s+)?optional[!.)]*\s*$/i, () => {
      asides.push('optional')
      return ''
    })

  working = extractAsides(working, asides)
    // "4 ½ cups cake flour 560g": a metric conversion trailing a measured line.
    .replace(/^(\s*[~≈]?[\d½¼¾⅓⅔⅛].*\S)\s+(\d+(?:\.\d+)?\s?(?:g|kg|ml|mL|l|oz))\.?\s*$/, (match, head: string, conversion: string) => {
      if (!/[a-z]/i.test(head.replace(/^[\d\s½¼¾⅓⅔⅛/.,–-]+/, ''))) return match
      asides.push(conversion.replace(/\s+/, ''))
      return head
    })
    // "600g / 1.2 lb chicken" — keep the first measure, note the conversion.
    .replace(DUAL_MEASURE, (_match, primary: string, alternative: string) => {
      asides.push(alternative.trim())
      return `${primary.trim()} `
    })
    // "one 14-ounce can" — a package size between the count and the container.
    .replace(PACKAGE_SIZE, (_match, count: string, size: string, sizeUnit: string) => {
      asides.push(`${size} ${sizeUnit.replace(/\.$/, '')}`)
      return `${count} `
    })
    .replace(/\s+/g, ' ')
    .trim()
  working = joinAdjectiveCommas(working)
  if (!working) return null

  // Split an explicit trailing preparation clause: "garlic, minced"
  let trailingClause = ''
  const commaIndex = working.indexOf(',')
  if (commaIndex !== -1) {
    trailingClause = cleanEdges(working.slice(commaIndex + 1))
    working = cleanEdges(working.slice(0, commaIndex))
  }

  let tokens = expandRangeTokens(tokenize(working))
  tokens = stripHedges(tokens)
  if (tokens.length === 0) return null

  // "Small splash of vinegar", "large pinch of salt": a size, then a unit.
  if (tokens.length > 2 && SIZE_WORDS.has(tokens[0].toLowerCase()) && matchUnit(tokens.slice(1))) {
    asides.push(tokens[0].toLowerCase())
    tokens = tokens.slice(1)
  }

  const quantityMatch = parseLeadingQuantity(tokens)
  // "a"/"an" is a weak anchor: it appears in prose as often as in a recipe.
  const articleQuantity = /^an?$/i.test(tokens[0] ?? '')
  let quantity: number | undefined
  let displayQuantity: string | undefined
  if (quantityMatch) {
    quantity = quantityMatch.value
    displayQuantity = quantityMatch.display
    tokens = tokens.slice(quantityMatch.consumed)
  }

  // "2 of the cups" / "cups of flour" filler
  if (tokens[0]?.toLowerCase() === 'of') tokens = tokens.slice(1)

  // "1 heaping tbsp", "2 large cloves": a size word between amount and unit.
  if (quantity !== undefined && tokens.length > 2 && SIZE_WORDS.has(tokens[0].toLowerCase()) && matchUnit(tokens.slice(1))) {
    asides.push(tokens[0].toLowerCase())
    tokens = tokens.slice(1)
  }

  let unit: string | undefined
  const unitMatch = matchUnit(tokens)
  // With no number, only a "pinch"-type word is a unit: "can you make…" is not
  // a can of anything, and "cloves" alone is the spice.
  if (
    unitMatch &&
    (quantity !== undefined || (NUMBERLESS_UNITS.has(unitMatch.unit) && tokens.length > unitMatch.consumed))
  ) {
    unit = unitMatch.unit
    tokens = tokens.slice(unitMatch.consumed)
    if (tokens[0]?.toLowerCase() === 'of') tokens = tokens.slice(1)

    // A second amount right after the first: "handful or 60 g", "1 lb 8 oz".
    const alternative = tokens[0]?.toLowerCase() === 'or' ? 1 : 0
    const secondAmount = parseLeadingQuantity(tokens.slice(alternative))
    const secondUnit = secondAmount ? matchUnit(tokens.slice(alternative + secondAmount.consumed)) : null
    if (secondAmount && secondUnit) {
      const used = alternative + secondAmount.consumed + secondUnit.consumed
      asides.push(`${alternative ? 'or ' : '+ '}${tokens.slice(alternative, used).join(' ')}`)
      tokens = tokens.slice(used)
      if (tokens[0]?.toLowerCase() === 'of') tokens = tokens.slice(1)
    }
  }

  tokens = stripHedges(tokens)
  const remainder = cleanEdges(tokens.join(' '))
    .replace(LEADING_FILLER, '')
    .replace(NAME_TAIL, (tail) => {
      // In a written list the tail is a real note ("plus extra for frying");
      // in speech it is an instruction ("to a sauce pan") and is dropped.
      if (!strict) asides.push(tail.trim())
      return ''
    })
  if (!remainder) {
    // "three cloves of garlic" where garlic landed in the trailing clause
    if (!trailingClause) return null
  }

  const leading = splitLeadingPreparation(tokenize(remainder))
  const trailing = splitTrailingPreparation(leading.name)

  const name = cleanEdges(trailing.name.join(' ')).toLowerCase()
  const preparationParts = [
    ...leading.preparation,
    ...trailing.preparation,
    trailingClause,
    ...asides,
  ]
    .map((part) => cleanEdges(part))
    .filter(Boolean)

  if (isRejectedName(name)) return null
  // "a zesty chipotle crema sauce" is a description, not a line on a list.
  if (strict && articleQuantity && !unit && name.split(/\s+/).length >= 3) {
    return null
  }
  if (strict && quantity === undefined && !unit) {
    if (!looksLikeFood(name)) return null
    // Without a quantity to anchor it, only a short noun phrase is credible;
    // anything longer is a sentence that happens to mention food.
    if (name.split(/\s+/).length > 2) return null
  }

  return {
    id: nextIngredientId(),
    quantity,
    displayQuantity: quantity !== undefined ? displayQuantity : undefined,
    unit,
    name,
    preparation: preparationParts.length
      ? Array.from(new Set(preparationParts.map((part) => part.toLowerCase()))).join(', ')
      : undefined,
    checked: false,
  }
}

const CHUNK_SPLIT = /\s*(?:,\s*and\s+|,\s*|\s+and\s+|\s+plus\s+|;\s*)/i

/**
 * "two cups of flour, one teaspoon of salt, and three eggs"
 * -> three ingredient phrases.
 */
export function splitIngredientChunks(text: string): string[] {
  const protectedText = text
    .replace(/\bsalt\s+and\s+pepper\b/gi, 'salt-and-pepper')
    .replace(/\boil\s+and\s+vinegar\b/gi, 'oil-and-vinegar')

  return protectedText
    .split(CHUNK_SPLIT)
    .map((chunk) => cleanEdges(chunk).replace(/-and-/g, ' and '))
    .filter(Boolean)
}

const normalizeName = (name: string) => name.replace(/s$/, '').trim()

/** "rice" and "basmati rice" are the same shopping-list line. */
function sameIngredient(a: string, b: string): boolean {
  if (a === b) return true
  return a.endsWith(` ${b}`) || b.endsWith(` ${a}`)
}

const detail = (ingredient: Ingredient) =>
  (ingredient.quantity !== undefined ? 2 : 0) +
  (ingredient.unit ? 1 : 0) +
  (ingredient.preparation ? 1 : 0)

/** Merges duplicates, keeping the most specific name and the stated quantity. */
export function dedupeIngredients(ingredients: Ingredient[]): Ingredient[] {
  const merged: Ingredient[] = []

  for (const ingredient of ingredients) {
    const key = normalizeName(ingredient.name)
    // Paprika for the chicken and paprika for the sauce stay in their own groups.
    const index = merged.findIndex(
      (item) =>
        (item.group ?? '') === (ingredient.group ?? '') && sameIngredient(normalizeName(item.name), key),
    )

    if (index === -1) {
      merged.push(ingredient)
      continue
    }

    const existing = merged[index]

    // The same ingredient listed twice with the same unit — "1 tsp paprika" for
    // the chicken and again for the sauce — is one line on a shopping list, so
    // the amounts add up. Ranges are left alone; their sum is not meaningful.
    const isRange = (item: Ingredient) => /[-–]/.test(item.displayQuantity ?? '')
    if (
      normalizeName(existing.name) === key &&
      existing.quantity !== undefined &&
      ingredient.quantity !== undefined &&
      (existing.unit ?? '') === (ingredient.unit ?? '') &&
      !isRange(existing) &&
      !isRange(ingredient)
    ) {
      const total = existing.quantity + ingredient.quantity
      merged[index] = { ...existing, quantity: total, displayQuantity: formatQuantity(total) }
      continue
    }

    merged[index] = {
      ...existing,
      // Prefer whichever mention actually carried numbers.
      quantity: existing.quantity ?? ingredient.quantity,
      displayQuantity: existing.displayQuantity ?? ingredient.displayQuantity,
      unit: existing.unit ?? ingredient.unit,
      preparation: existing.preparation ?? ingredient.preparation,
      // ...and whichever named it more precisely.
      name:
        ingredient.name.length > existing.name.length && detail(ingredient) >= detail(existing)
          ? ingredient.name
          : existing.name,
    }
  }

  return merged
}

/** Recomputes display strings for a serving-size change. */
export function scaleIngredient(ingredient: Ingredient, factor: number): Ingredient {
  if (ingredient.quantity === undefined) return ingredient
  const scaled = ingredient.quantity * factor
  return {
    ...ingredient,
    quantity: scaled,
    displayQuantity: formatQuantity(scaled),
  }
}