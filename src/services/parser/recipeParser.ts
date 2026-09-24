import type { Direction, Ingredient, ParsedRecipe, ParseWarning } from '../../types/recipe'
import {
  containsCookingVerb,
  createDirection,
  extractDuration,
  hasImperativeClause,
  isNoise,
  renumberDirections,
  splitInstructionClauses,
  splitSentences,
  startsWithCookingVerb,
} from './directionParser'
import {
  BULLET,
  dedupeIngredients,
  parseIngredientPhrase,
  splitIngredientChunks,
} from './ingredientParser'
import { parseNumericToken } from './numberParser'
import { canonicalUnit } from './units'
import {
  extractFootnotes,
  inferMissingHeadings,
  isRunOnIngredientLine,
  looksLikeProse,
  quantityStartCount,
  reflowInlineHeadings,
  splitAtGroupLabels,
  splitAtInlineBullets,
  splitRunOnDirections,
  splitRunOnIngredients,
} from './reflow'
import { splitIntoBlocks, hasHeadings, type TextBlock } from './sections'
import { ADD_VERB_PATTERN, FOOD_KEYWORDS, PREP_WORDS } from './vocabulary'

/** Strips caption noise: hashtags, [Music], emoji, SEO keyword lists. */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:music|laughs?|applause)\)/gi, ' ')
    // TikTok's summary ends in an SEO keyword dump that is pure noise.
    .replace(/^\s*keywords?\s*:.*$/gim, ' ')
    .replace(/#[\w]+/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    // "🧑‍🍳: @close to home cooking" — an emoji-labelled credit, up to the next hashtag
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}‍️]+\s*:\s*@[^\n#.!]*/gu, ' ')
    // Handles and reply headers: "Replying to @x", "@MagnessFarmsButchers"
    .replace(/\breplying\s+to\s+@[\w.]+/gi, ' ')
    .replace(/(^|\s)@[\w.]+/g, '$1')
    // Credit lines: "Idea Credit: @x", "inspo: @x", "🧑‍🍳: @x"
    .replace(/\b(?:idea\s+)?credits?\s*:[\s:]*/gi, ' ')
    .replace(/\binspo\s*:[\s:]*/gi, ' ')
    // Invisible spacers TikTok captions use for line breaks (braille blank, zero-width)
    .replace(/[⠀​‌⁠]/g, ' ')
    // The fraction slash in "1⁄3" is not the ASCII slash.
    .replace(/(\d)⁄(\d)/g, '$1/$2')
    // "~Salmon~" and "~For Serving ~" are group headings.
    .replace(/~\s*([A-Za-z][^~\n]{1,30}?)\s*~/g, '\n$1:\n')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\*\*/g, '')
    // Keycap emoji step numbers (a digit plus U+20E3, common in TikTok captions) become "1. ".
    .replace(/(\d)\uFE0F?\u20E3\s*/g, '$1. ')
    .replace(/[\uFE0F\u200D]/g, '')
    // Degree look-alikes: ℉ ℃ and the ordinal º people type for °.
    .replace(/℉/g, '°F')
    .replace(/℃/g, '°C')
    .replace(/(\d)\s*º/g, '$1°')
    .replace(/\b(um+|uh+|erm+|like,)\s+/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Finds a leading add-verb and returns the text that follows it. */
function stripAddVerb(sentence: string): string | null {
  const match = ADD_VERB_PATTERN.exec(sentence)
  return match ? sentence.slice(match[0].length).trim() : null
}

function parseChunksAsIngredients(text: string, strict = true): {
  ingredients: Ingredient[]
  unparsed: string[]
} {
  const ingredients: Ingredient[] = []
  const unparsed: string[] = []

  for (const chunk of splitIngredientChunks(text)) {
    const ingredient = parseIngredientPhrase(chunk, { strict })
    if (ingredient) ingredients.push(ingredient)
    else unparsed.push(chunk)
  }

  return { ingredients, unparsed }
}

const SERVINGS_PATTERN =
  /\b(?:serves|servings?\s*[:=]?|makes|feeds|yields?)\s*(?:about\s+)?(\d+(?:\s*[–—-]\s*\d+)?|[\w./]+)/i

export function extractServings(text: string): number | undefined {
  const match = SERVINGS_PATTERN.exec(text)
  if (!match) return undefined
  // A range ("serves 2-4") is reported at its lower bound.
  const lower = match[1].split(/\s*[–—-]\s*/)[0]
  const value = parseNumericToken(lower)
  if (value === null || value < 1 || value > 64) return undefined
  return Math.round(value)
}

/** "425 calories", "Calories: 425", "425 kcal per serving" */
export function extractCalories(text: string): number | undefined {
  const match =
    /\b(\d{2,4})\s*(?:k?cal(?:ories)?)\b/i.exec(text) ??
    /\bcalories\s*[:=]?\s*(\d{2,4})\b/i.exec(text)
  if (!match) return undefined
  const value = Number(match[1])
  return value >= 10 && value <= 5000 ? value : undefined
}

const TITLE_MAX_WORDS = 9

/** Uses the first line as a title when it reads like one rather than a step. */
export function extractTitle(text: string): string | undefined {
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean)
  if (!firstLine) return undefined

  const candidate = firstLine.replace(/[.!?]+$/, '').trim()
  const words = candidate.split(/\s+/)
  if (words.length > TITLE_MAX_WORDS || candidate.length > 64) return undefined
  if (startsWithCookingVerb(candidate)) return undefined
  if (/\d/.test(candidate) && parseIngredientPhrase(candidate)) return undefined

  return candidate
    .split(/\s+/)
    .map((word) =>
      word.length > 2 || words.length === 1
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word,
    )
    .join(' ')
}

const BULLET_PREFIX = BULLET
/** "1. ", "2) ", "Step 3: ", "4 - " — always followed by whitespace, so "1–2 tbsp" and "1.5 cups" survive. */
const NUMBER_PREFIX = /^(?:step\s*)?\d{1,2}(?:[.)]|\s*:|\s+[-–])\s+|^step\s*\d{1,2}\s+/i
/** A line that is nothing but a step marker: "Step 2", "2." */
const STEP_MARKER_ONLY = /^(?:step\s*)?\d{1,2}\s*[.):\-–]?\s*$/i
/** "Chicken: 2 breasts, 1 tbsp oil" — a grouping label in front of its items. */
const GROUP_LABEL = /^([A-Za-z][\w &'’-]{0,28}):\s+(?=\S)/
/** A line that is only a label: "Spicy mayo:", "For the sauce:" */
const LABEL_ONLY = /^([A-Za-z][\w &'’,()-]{0,40}):$/
/** "Flour: 2 cups" — an ingredient and its amount, not a group. */
const AMOUNT_ONLY = /^[~≈]?[\d½¼¾⅓⅔⅛][\d½¼¾⅓⅔⅛/.,\s–-]*\s*[a-zA-Z]{0,12}\.?$/

/**
 * A short Title Case line with no quantity may be a group header ("Optional
 * Garnish"). Whether it is depends on what follows — see parseIngredientBlock.
 */
function isGroupLabel(line: string): boolean {
  if (/\d/.test(line)) return false
  const words = line.split(/\s+/).filter((word) => /[a-z]/i.test(word))
  if (words.length === 0 || words.length > 3) return false
  return words.every((word) => /^[A-Z]/.test(word))
}

/** "Optional Garnish Fresh parsley" / "For serving: lime wedges" — a label, then the item. */
const LEADING_GROUP_LABEL =
  /^((?:optional\s+)?(?:garnish(?:es)?|toppings?|to\s+serve|for\s+(?:the\s+)?(?:garnish|topping|serving|sauce|marinade|dressing|glaze)))\s*:?\s+(?=[A-Z0-9½¼¾⅓⅔])/i

/**
 * Normalises a label into a group name: "For the sauce:" -> "Sauce",
 * "SPICY MAYO" -> "Spicy mayo", "Sauce Ingredients" -> "Sauce". A bare
 * "Ingredients" is not a group.
 */
export function groupName(label: string): string | undefined {
  let name = label
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[:\s]+$/, '')
    .replace(/^ingredients?\s+for\s+/i, '')
    .replace(/\s*ingredients?$/i, '')
    .replace(/^for\s+(?:the\s+)?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name || /^ingredients?$/i.test(name)) return undefined
  if (name === name.toUpperCase()) name = name.toLowerCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** "salt, garlic, onion, smoked paprika" — short unquantified items, not "garlic, minced". */
function isBareList(text: string): boolean {
  if (/\d/.test(text)) return false
  const chunks = text.split(',').map((chunk) => chunk.trim()).filter(Boolean)
  if (chunks.length < 3 || !chunks.every((chunk) => chunk.split(/\s+/).length <= 4)) return false
  // "shrimp, peeled and deveined, tails removed" is one item and its prep. A
  // prep phrase *ends* in the participle; "smoked paprika" merely starts with one.
  const describesPrep = (chunk: string) => {
    const last = chunk.toLowerCase().split(/\s+/).pop() ?? ''
    return PREP_WORDS.has(last) || /[a-z]{2}[^e]ed$/.test(last)
  }
  if (chunks.slice(1).some(describesPrep)) return false
  // "green peas, frozen or fresh, or more to taste" — qualifiers, not items.
  const isQualifier = (chunk: string) => {
    const words = chunk.toLowerCase().split(/\s+/)
    if (/^(?:or|and|plus|as|to|if)$/.test(words[0])) return true
    return words.includes('or') && words.length <= 3 && !words.some((word) => FOOD_KEYWORDS.has(word))
  }
  if (chunks.slice(1).some(isQualifier)) return false
  return !/^(?:to\s+taste|divided|optional|for\s)/i.test(chunks[1])
}

/** Group names that are always sections, even as a single word. */
const SECTION_WORDS = new Set([
  'sauce', 'dressing', 'marinade', 'topping', 'toppings', 'garnish', 'glaze',
  'filling', 'dough', 'crust', 'batter', 'frosting', 'icing', 'seasoning', 'base',
  'assembly', 'serving', 'crumble', 'streusel', 'syrup', 'vinaigrette', 'slaw',
])

function startsWithQuantity(text: string): boolean {
  return /^[~≈]?[\d½¼¾⅓⅔⅛]/.test(text.replace(BULLET_PREFIX, '').trim())
}

type BlockItem = { kind: 'label'; name?: string } | { kind: 'line'; text: string }

/**
 * Turns an ingredients block into labels and one-ingredient lines. Flattened
 * captions put a whole list — sub-groups, footnotes and all — on one line, so
 * this splits at group labels, pulls footnotes out, and splits run-on lists.
 */
function blockItems(lines: string[], notes: string[]): BlockItem[] {
  const items: BlockItem[] = []

  for (const raw of lines) {
    for (const piece of splitAtGroupLabels(raw)) {
      const { text, notes: footnotes } = extractFootnotes(piece)
      notes.push(...footnotes)
      let body = text
        .replace(BULLET_PREFIX, '')
        // "Serves 2" sitting in the list is read by extractServings, not an ingredient.
        .replace(/\b(?:serves|makes|yields?)\s*:?\s*\d+(?:\s*[-–]\s*\d+)?(?:\s+(?:people|servings?|portions?))?/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!body) continue

      const label = GROUP_LABEL.exec(body)
      if (label) {
        const rest = body.slice(label[0].length).trim()
        if (/^(?:notes?|tips?)$/i.test(label[1].trim())) {
          notes.push(rest)
          continue
        }
        if (AMOUNT_ONLY.test(rest)) {
          // "Flour: 2 cups" -> "2 cups Flour"
          body = `${rest} ${label[1]}`
        } else {
          items.push({ kind: 'label', name: groupName(label[1]) })
          body = rest
        }
      }

      const labelOnly = LABEL_ONLY.exec(body)
      if (labelOnly) {
        items.push({ kind: 'label', name: groupName(labelOnly[1]) })
        continue
      }

      // A chatty sentence inside the list is a note, and must be caught before
      // it is split into word-salad "ingredients".
      if (!startsWithQuantity(body) && looksLikeProse(body.replace(/\([^)]*\)/g, ' '))) {
        notes.push(body)
        continue
      }

      // "…paprika. 1/2 tsp black pepper. 1 tbsp soy sauce" — sentences that are
      // each an ingredient.
      const bullets = splitAtInlineBullets(body).flatMap((bullet) =>
        bullet.split(/(?<=[a-z)])\.\s+(?=[~≈]?[\d½¼¾⅓⅔⅛])/),
      )
      for (const bullet of bullets) {
        let entry = bullet.replace(BULLET_PREFIX, '').trim()
        if (!entry) continue
        const bulletLabel = LABEL_ONLY.exec(entry)
        if (bulletLabel) {
          items.push({ kind: 'label', name: groupName(bulletLabel[1]) })
          continue
        }
        const inlineLabel = GROUP_LABEL.exec(entry)
        if (inlineLabel && !AMOUNT_ONLY.test(entry.slice(inlineLabel[0].length).trim())) {
          items.push({ kind: 'label', name: groupName(inlineLabel[1]) })
          entry = entry.slice(inlineLabel[0].length).trim()
        }

        const lines = isRunOnIngredientLine(entry) ? splitRunOnIngredients(entry) : [entry]
        for (const line of lines) {
          const lead = LEADING_GROUP_LABEL.exec(line)
          const onlyLabel = LABEL_ONLY.exec(line.trim())
          if (lead) {
            items.push({ kind: 'label', name: groupName(lead[1]) })
            items.push({ kind: 'line', text: line.slice(lead[0].length) })
          } else if (onlyLabel) {
            items.push({ kind: 'label', name: groupName(onlyLabel[1]) })
          } else {
            items.push({ kind: 'line', text: line })
          }
        }
      }
    }
  }
  return items
}

/** "8 oz block", "2 tbsp", "1 can" — an amount with no ingredient named. */
function isAmountOnly(text: string): boolean {
  const tokens = text.replace(BULLET_PREFIX, '').trim().split(/\s+/)
  if (!tokens.length || !/^[~≈]?[\d½¼¾⅓⅔⅛]/.test(tokens[0])) return false
  const rest = tokens.slice(1).filter((token) => !/^[\d½¼¾⅓⅔⅛/.,–-]+$/.test(token))
  return rest.length <= 2 && rest.every((token) => canonicalUnit(token) !== null)
}

/**
 * "1 tsp ginger powder, onion powder, garlic powder" — one amount written once
 * for a list of items, meaning that amount of each.
 */
function sharedAmountList(text: string): string[] | undefined {
  const match = /^([~≈]?[\d½¼¾⅓⅔⅛][\d½¼¾⅓⅔⅛/.,–-]*(?:\s+[\d½¼¾⅓⅔⅛/]+)?\s*([A-Za-z]+\.?)?)\s+(?:each\s+)?(.+)$/.exec(text)
  if (!match || (match[2] && canonicalUnit(match[2]) === null)) return undefined
  const rest = match[3]
  if (!isBareList(rest)) return undefined
  return splitIngredientChunks(rest).map((item) => `${match[1]} ${item}`)
}

/**
 * A Title Case line is a group header only when a real ingredient follows it:
 * "Chicken" before "2 chicken breasts" is a header, "Salt" at the end of a list
 * (or before "Pepper") is an ingredient.
 */
function actsAsGroupLabel(text: string, next: BlockItem | undefined): boolean {
  if (!isGroupLabel(text) || next?.kind !== 'line') return false
  const nextText = next.text.replace(BULLET_PREFIX, '').trim()
  // "Feta" then "8 oz block" is one ingredient split in two, not a group.
  if (isGroupLabel(nextText) || isAmountOnly(nextText)) return false
  const words = text.split(/\s+/).filter((word) => /[a-z]/i.test(word))
  if (words.length >= 2) return true
  // One word is a header only if it names a section ("Sauce") or the next line
  // is about it ("Chicken" then "2 chicken breasts"); "Edamame" followed by
  // "1/2 avocado" is just an ingredient.
  const word = words[0].toLowerCase()
  return SECTION_WORDS.has(word) || nextText.toLowerCase().includes(word.replace(/s$/, ''))
}

function parseIngredientBlock(
  lines: string[],
  blockGroup?: string,
): { ingredients: Ingredient[]; notes: string[] } {
  const ingredients: Ingredient[] = []
  const notes: string[] = []
  let group = blockGroup

  const add = (parsed: Ingredient | null) => {
    if (parsed) ingredients.push(group ? { ...parsed, group } : parsed)
  }

  const items = blockItems(lines, notes)
  items.forEach((item, index) => {
    if (item.kind === 'label') {
      group = item.name ?? blockGroup
      return
    }

    const stripped = item.text.replace(BULLET_PREFIX, '').replace(NUMBER_PREFIX, '').trim()
    if (!stripped) return

    if (actsAsGroupLabel(stripped, items[index + 1])) {
      group = groupName(stripped) ?? group
      return
    }
    // A line that opens with an amount is an ingredient, however chatty its
    // aside ("1–2 cups cheese of your choice (I used mozzarella…)").
    if (!startsWithQuantity(stripped) && looksLikeProse(stripped.replace(/\([^)]*\)/g, ' '))) {
      notes.push(stripped)
      return
    }

    // Prevent obliterating lines entirely wrapped in parentheses (e.g., "(optional: garlic, herbs)")
    let withoutParens = stripped.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    if (!withoutParens) {
      withoutParens = stripped.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
    }
    const text = withoutParens

    // "8 oz block" after "Feta": the amount belongs to the item before it.
    const previous = ingredients[ingredients.length - 1]
    if (isAmountOnly(text) && previous && previous.quantity === undefined && !previous.unit) {
      const amount = parseIngredientPhrase(text, { strict: false })
      if (amount?.quantity !== undefined) {
        // "8 oz block": 8 oz is the amount, "block" says what form it comes in.
        const form = amount.name && canonicalUnit(amount.name) ? amount.name : undefined
        ingredients[ingredients.length - 1] = {
          ...previous,
          quantity: amount.quantity,
          displayQuantity: amount.displayQuantity,
          unit: amount.unit,
          preparation: [previous.preparation, form].filter(Boolean).join(', ') || undefined,
        }
        return
      }
    }

    const shared = sharedAmountList(text)
    if (shared) {
      shared.forEach((line) => add(parseIngredientPhrase(line, { strict: false })))
      return
    }

    if (isBareList(text)) {
      splitIngredientChunks(text).forEach((chunk) => add(parseIngredientPhrase(chunk, { strict: false })))
      return
    }

    // Count amounts, not digits: "1/2 diced onion, diced" holds one amount.
    const isList = quantityStartCount(text) >= 2 && text.includes(',')

    if (isList) {
      splitIngredientChunks(text).forEach((chunk) => add(parseIngredientPhrase(chunk, { strict: false })))
      return
    }

    let parsed = parseIngredientPhrase(text, { strict: false })

    // Fallback 1: Strip marketing/descriptive suffixes (e.g., "1 lb beef: The heart of the dish")
    if (!parsed) {
      const suffixMatch = text.match(/(:|\s+[-–—]\s+)/)
      if (suffixMatch && suffixMatch.index !== undefined) {
        parsed = parseIngredientPhrase(text.slice(0, suffixMatch.index).trim(), { strict: false })
      }
    }

    if (parsed) {
      add(parsed)
    } else if (text.includes(',') || /\band\b/i.test(text)) {
      // Fallback 2: Parse as a comma-separated list without quantities (e.g., "Garlic powder, salt, pepper")
      splitIngredientChunks(text).forEach((chunk) => add(parseIngredientPhrase(chunk, { strict: false })))
    }
  })

  return { ingredients, notes }
}

/**
 * A directions block that arrived as one long paragraph was flattened; split it
 * into steps first. A normal block keeps its lines, however long.
 */
function expandDirectionLines(lines: string[]): string[] {
  const content = lines.filter((line) => line.trim())
  const flattened =
    (content.length === 1 && content[0].length >= 80 && splitSentences(content[0]).length >= 2) ||
    content.some((line) => line.length >= 600)
  return flattened ? content.flatMap((line) => splitRunOnDirections(line)) : content
}

interface DirectionLine {
  text: string
  section?: string
}

/** Labels that are asides, not stages of the method. */
const NOT_A_SECTION = /^(?:optional|note|notes|tip|tips|pro\s+tip)$/i

function parseDirectionBlock(lines: string[], blockSection?: string): DirectionLine[] {
  const steps: DirectionLine[] = []
  let section = blockSection
  // "Step 2" on its own line vouches for the text that follows it.
  let vouched = false

  for (const raw of expandDirectionLines(lines)) {
    if (STEP_MARKER_ONLY.test(raw.trim())) {
      vouched = true
      continue
    }
    const numbered = vouched || NUMBER_PREFIX.test(raw.trim())
    vouched = false
    let line = raw.replace(BULLET_PREFIX, '').replace(NUMBER_PREFIX, '').trim()
    if (!line || isNoise(line)) continue

    // "For the Cake:" / "Salmon preparation:" name a stage of the method.
    // "Season the chicken:" starts with a verb, so it labels a single step.
    const label = /^([A-Z][^:]{1,40}):(?:\s+(.*))?$/.exec(line)
    if (label && !startsWithCookingVerb(label[1]) && !NOT_A_SECTION.test(label[1].trim())) {
      const words = label[1].trim().split(/\s+/).length
      if (words <= 5) {
        section = groupName(label[1]) ?? section
        if (!label[2]) continue
        line = label[2].trim()
      }
    }

    // "Season the chicken:" is a label for the sentence that follows it.
    const previous = steps[steps.length - 1]
    if (previous && /:$/.test(previous.text)) {
      previous.text = `${previous.text} ${line}`
      continue
    }

    // Numbered lines are trusted; unnumbered ones must read like instructions,
    // which keeps SEO link lists and marketing prose out of the steps.
    if (!numbered && !hasImperativeClause(line) && !/:$/.test(line)) continue

    steps.push({ text: line, section })
  }

  return steps.filter((step) => !/:$/.test(step.text))
}

/** Sentence-by-sentence pass over spoken-style transcripts. */
function parseProse(text: string): {
  ingredients: Ingredient[]
  directions: Direction[]
} {
  const ingredients: Ingredient[] = []
  const directions: Direction[] = []

  for (const sentence of splitSentences(text)) {
    if (isNoise(sentence)) continue

    const afterAddVerb = stripAddVerb(sentence)

    if (afterAddVerb !== null) {
      const { ingredients: found, unparsed } = parseChunksAsIngredients(afterAddVerb)
      ingredients.push(...found)

      // Pure ingredient call-out ("Add two cups of flour and three eggs.")
      // contributes no step. Anything left over is a real instruction.
      const leftover = unparsed.filter(
        (chunk) => containsCookingVerb(chunk) || chunk.split(/\s+/).length > 2,
      )
      if (found.length === 0 || leftover.length > 0) {
        for (const clause of splitInstructionClauses(sentence)) {
          directions.push(createDirection(clause, directions.length + 1))
        }
      }
      continue
    }

    if (hasImperativeClause(sentence)) {
      for (const clause of splitInstructionClauses(sentence)) {
        if (clause.trim().split(/\s+/).length < 2) continue
        directions.push(createDirection(clause, directions.length + 1))
      }
      // A step can still name a new ingredient: "Sprinkle 2 tsp of paprika."
      const { ingredients: inline } = parseChunksAsIngredients(sentence)
      ingredients.push(...inline.filter((item) => item.quantity !== undefined))
      continue
    }

    // Not an instruction — maybe a bare ingredient line ("Two cups of flour.")
    const { ingredients: found } = parseChunksAsIngredients(sentence)
    ingredients.push(...found)
  }

  return { ingredients, directions }
}

function parseBlocks(blocks: TextBlock[]): {
  ingredients: Ingredient[]
  directions: Direction[]
  notes: string[]
} {
  const ingredients: Ingredient[] = []
  const directions: Direction[] = []
  const notes: string[] = []

  for (const block of blocks) {
    if (block.kind === 'ingredients') {
      const parsed = parseIngredientBlock(block.lines, groupName(block.heading))
      ingredients.push(...parsed.ingredients)
      notes.push(...parsed.notes)
    } else if (block.kind === 'directions') {
      for (const step of parseDirectionBlock(block.lines, directionSection(block.heading))) {
        const direction = createDirection(step.text, directions.length + 1)
        directions.push(step.section ? { ...direction, section: step.section } : direction)
      }
    } else if (block.kind === 'notes') {
      notes.push(...block.lines.map((line) => line.replace(BULLET_PREFIX, '').trim()))
    }
  }

  return { ingredients, directions, notes }
}

/**
 * "REHEAT INSTRUCTIONS (from frozen):" -> "Reheat (from frozen)". A plain
 * "Instructions" or "Method" heading names no particular stage.
 */
export function directionSection(heading: string): string | undefined {
  const generic = /\b(?:step[-\s]?by[-\s]?step|directions?|instructions?|method|steps|how\s+to(?:\s+make(?:\s+it)?)?|preparation|procedure|recipe)\b/gi
  let name = heading.replace(/[:\s]+$/, '').replace(generic, ' ').replace(/\s+/g, ' ').trim()
  if (!name || /^\([^)]*\)$/.test(name)) return undefined
  // "REHEAT (from frozen)" -> "Reheat (from frozen)"
  name = name.replace(/\b[A-Z]{2,}\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase())
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function totalTimeFromDirections(directions: Direction[]): number | undefined {
  const seconds = directions.reduce(
    (sum, direction) => sum + (direction.timerSeconds ?? 0),
    0,
  )
  if (seconds <= 0) return undefined
  return Math.max(1, Math.round(seconds / 60))
}

/**
 * The single public entry point. Deterministic, offline, and independent of
 * where the transcript came from.
 */
export function parseRecipe(transcript: string): ParsedRecipe {
  const warnings: ParseWarning[] = []
  const text = inferMissingHeadings(reflowInlineHeadings(cleanTranscript(transcript ?? '')))

  if (!text) {
    return {
      ingredients: [],
      directions: [],
      warnings: ['empty-transcript', 'no-recipe-content'],
      confidence: 0,
    }
  }

  const blocks = splitIntoBlocks(text)
  let ingredients: Ingredient[] = []
  let directions: Direction[] = []
  let notes: string[] = []

  if (hasHeadings(blocks)) {
    const fromBlocks = parseBlocks(blocks)
    ingredients = fromBlocks.ingredients
    directions = fromBlocks.directions
    notes = fromBlocks.notes
  }

  // No headings, or headings that yielded nothing usable: read it as speech.
  // When the list was found but no method, look for the method only outside
  // the list — "1 red pepper, cut into quarters" is an ingredient, not a step.
  if (ingredients.length === 0 || directions.length === 0) {
    const outsideList =
      ingredients.length > 0
        ? blocks
            .filter((block) => block.kind !== 'ingredients')
            .map((block) => block.lines.join('\n'))
            .join('\n')
        : text
    const prose = parseProse(outsideList)
    if (ingredients.length === 0) ingredients = prose.ingredients
    if (directions.length === 0) directions = prose.directions
  }

  ingredients = dedupeIngredients(ingredients)
  directions = renumberDirections(directions)

  if (ingredients.length === 0) warnings.push('no-ingredients')
  if (directions.length === 0) warnings.push('no-directions')
  if (ingredients.length === 0 && directions.length === 0) {
    warnings.push('no-recipe-content')
  }
  if (
    ingredients.length > 0 &&
    ingredients.every((ingredient) => ingredient.quantity === undefined)
  ) {
    warnings.push('missing-quantities')
  }

  const quantified = ingredients.filter((i) => i.quantity !== undefined).length
  const confidence = Math.min(
    1,
    (Math.min(ingredients.length, 6) / 6) * 0.45 +
      (Math.min(directions.length, 5) / 5) * 0.35 +
      (ingredients.length ? quantified / ingredients.length : 0) * 0.2,
  )

  return {
    title: extractTitle(text),
    servings: extractServings(text),
    calories: extractCalories(text),
    totalTime: totalTimeFromDirections(directions),
    notes: notes.length ? notes.join('\n') : undefined,
    ingredients,
    directions,
    warnings,
    confidence: Math.round(confidence * 100) / 100,
  }
}

export { extractDuration }