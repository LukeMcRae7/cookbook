/**
 * Turning a TikTok caption into a recipe title.
 *
 * Captions open with chatter ("Here is my…", "Let's make a…"), shout
 * ("SALMON BOWLS ON ROTATION"), or bury the name mid-sentence ("This Peas and
 * Pancetta Pasta is the best…"). The dish name is almost always a Title Case
 * phrase containing a food word, so candidates are tried in order of how
 * reliable they are, and a title that names no food is never preferred.
 */

import { FOOD_KEYWORDS } from '../parser/vocabulary'

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u
const EMOJI_GLOBAL = new RegExp(EMOJI.source, 'gu')

const MAX_TITLE_LENGTH = 60

/** Dish words on top of the ingredient vocabulary, for recognising a name. */
const DISH_WORDS = new Set([
  'smoothie', 'smoothies', 'soup', 'soups', 'salad', 'bowl', 'bowls', 'cake',
  'cakes', 'cookie', 'cookies', 'sandwich', 'sandwiches', 'wrap', 'wraps',
  'taco', 'tacos', 'burrito', 'burritos', 'pizza', 'burger', 'burgers',
  'pancakes', 'waffles', 'muffins', 'pie', 'tart', 'stew', 'chili', 'ramen',
  'lasagna', 'casserole', 'fries', 'dip', 'brownies', 'bars', 'bites', 'toast',
  'omelette', 'omelet', 'frittata', 'quesadilla', 'enchiladas', 'risotto',
  'skillet', 'bake', 'breakfast', 'dinner', 'lunch', 'dessert', 'oats',
  'noodles', 'pasta', 'spaghetti', 'curry', 'stir', 'fry', 'pudding', 'loaf',
])

/** Hashtags too generic to name a dish. */
const GENERIC_TAGS = /^(?:recipes?|food|foodie|foodtok|fyp|foryou|foryoupage|easy|easyrecipes?|dinner|lunch|breakfast|cooking|homecooking|healthy|mealprep|viral|trending|tiktok\w*)$/i

function hasDishWord(text: string): boolean {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((word) => DISH_WORDS.has(word) || FOOD_KEYWORDS.has(word) || FOOD_KEYWORDS.has(word.replace(/e?s$/, '')))
}

/** Small words allowed inside a Title Case dish name. */
const TITLE_JOINERS = new Set(['&', '+', 'and', 'with', 'of', 'in', 'on', 'the', 'a', 'n', "'n'", 'w/', 'or', 'to'])

/** Capitalised words that start a *sentence*, not a name. */
const SENTENCE_OPENERS = new Set([
  'This', 'These', 'Here', 'I', 'It', 'My', 'So', 'We', 'You', 'Today', 'The',
  'A', 'An', 'If', 'When', 'Made', 'Making', 'Trying', 'POV', 'Ok', 'Okay',
  'Did', 'Let', 'Lets', 'Let’s', "Let's", 'How', 'Love', 'Check', 'Why', 'What',
])

/** "385 Calories 33g Protein" sits before "Ingredients" too, and is not a name. */
const NUTRITION = /\b(?:calories|kcal|protein|carbs?|fat|fiber|sugar|macros?)\b|\d+\s*g\b/i

const LEAD_INS =
  /^(?:here(?:'s|’s| is)\s+(?:my|the|a|an|how\s+(?:i|to)\s+make)|this\s+is\s+(?:my|the|how\s+i\s+make)|how\s+to\s+make(?:\s+the\s+most)?|how\s+i\s+make|making|made|let'?s\s+make|let’s\s+make|trying|love\s+this|it'?s|it’s|the\s+(?:best|easiest)|my\s+(?:favou?rite|go-?to)|my|easy|quick|simple|a|an)\s+/i

const TAIL_CHATTER =
  /\s+(?:full\s+recipe\b.*|recipe\s+(?:below|in\s+(?:the\s+)?(?:caption|comments|bio))\b.*|link\s+in\s+bio\b.*|on\s+my\s+(?:website|blog)\b.*|(?:in|at|for)\s+(?:my|our)\s+\w+|season|recipe)$/i

/** "Spicy Salmon Rice Bowls Serves 2" — the serving count is not the name. */
const SERVES_TAIL = /\s+(?:serves|makes|yields?)\s*:?\s*\d+.*$/i

function capitalRatio(words: string[]): number {
  if (words.length === 0) return 0
  return words.filter((word) => /^[A-Z0-9]/.test(word)).length / words.length
}

/** "honey chipotle chicken wrap" -> "Honey Chipotle Chicken Wrap"; "SALMON BOWLS" -> "Salmon Bowls" */
function toTitleCase(text: string): string {
  const small = new Set(['a', 'an', 'and', 'or', 'of', 'the', 'with', 'in', 'on', 'for', 'to'])
  return text
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && small.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function finish(title: string): string {
  let clean = title
    .replace(SERVES_TAIL, '')
    .replace(/\s+recipe$/i, '')
    .replace(/[\s,;:!.–—-]+$/, '')
    .trim()
  if (clean === clean.toUpperCase() || clean === clean.toLowerCase()) clean = toTitleCase(clean)
  if (clean.length <= MAX_TITLE_LENGTH) return clean
  const cut = clean.slice(0, MAX_TITLE_LENGTH)
  return cut.slice(0, cut.lastIndexOf(' ')).trim() || cut
}

interface Run {
  words: string[]
  /** What immediately follows the run: "," / "is" / "" */
  next: string
  start: number
}

/** Title Case runs in some text, with sentence openers trimmed off the front. */
function titleRuns(text: string): Run[] {
  const tokens = text.replace(EMOJI_GLOBAL, ' | ').split(/\s+/).filter(Boolean)
  const runs: Run[] = []
  let current: string[] = []
  let start = 0

  const close = (next: string) => {
    const words = [...current]
    while (
      words.length &&
      (SENTENCE_OPENERS.has(words[0].replace(/[,:]$/, '')) || TITLE_JOINERS.has(words[0].toLowerCase()))
    ) {
      words.shift()
    }
    while (words.length && TITLE_JOINERS.has(words[words.length - 1].toLowerCase())) words.pop()
    if (words.length) runs.push({ words, next, start })
    current = []
  }

  tokens.forEach((token, index) => {
    const bare = token.replace(/[,.!?:;"“”]+$/, '')
    const capital =
      (current.length === 0 ? /^(?:[A-Z][\w'’&-]*|\d+-[A-Za-z][\w-]*)$/ : /^[A-Z][\w'’&-]*$/).test(bare) ||
      (current.length > 0 && TITLE_JOINERS.has(bare.toLowerCase()))
    if (capital && token !== '|') {
      if (current.length === 0) start = index
      current.push(bare)
      if (bare !== token) close(token.slice(bare.length, bare.length + 1))
    } else if (current.length) {
      close(token === '|' ? '' : token.split(/\s/)[0])
    }
  })
  if (current.length) close('')
  return runs
}

/** "30-Min Marry Me Chicken 🔥" — the name the caption opens with. */
function leadingName(text: string): string | undefined {
  const [first] = titleRuns(text)
  if (!first || first.start !== 0) return undefined
  const name = first.words.join(' ')
  // "Million Dollar Spaghetti, step aside!" is addressing a dish, not naming this one.
  if (first.next === ',' || NUTRITION.test(name) || !hasDishWord(name)) return undefined
  if (first.words.length < 2) return undefined
  return name
}

/** "One Pot Creamy Chicken Pasta: Ingredients" — the name the creator gave it. */
function titleBeforeIngredients(caption: string): string | undefined {
  const match = /([A-Z][\w'’&-]*(?:\s+[\w'’&-]+){1,11})\s*:?\s+(?:Ingredients?|INGREDIENTS?)\b/.exec(
    caption.replace(EMOJI_GLOBAL, ' | '),
  )
  if (!match) return undefined

  const words = match[1].replace(SERVES_TAIL, '').replace(/:$/, '').trim().split(/\s+/)
  while (words.length > 1 && (capitalRatio(words) < 0.7 || !/^[A-Z]/.test(words[0]))) words.shift()
  const name = words.join(' ')
  if (words.length < 2 || capitalRatio(words) < 0.7 || NUTRITION.test(name)) return undefined
  return name
}

/** The best Title Case food name anywhere in the introduction. */
function namedInIntro(intro: string): string | undefined {
  const candidates = titleRuns(intro).filter(
    (run) => run.words.length >= 2 && hasDishWord(run.words.join(' ')) && !NUTRITION.test(run.words.join(' ')),
  )
  if (candidates.length === 0) return undefined
  // Prefer names not followed by a comma, then longer ones, then earlier ones.
  const namesDish = (run: Run) => run.words.some((word) => DISH_WORDS.has(word.toLowerCase()))
  const ranked = [...candidates].sort(
    (a, b) =>
      Number(namesDish(b)) - Number(namesDish(a)) ||
      Number(a.next === ',') - Number(b.next === ',') ||
      b.words.length - a.words.length ||
      a.start - b.start,
  )
  return ranked[0].words.join(' ')
}

/** "My oatmeal peanut butter smoothie is a great…" -> "oatmeal peanut butter smoothie" */
function openingClause(text: string): string | undefined {
  let opening = text
    .split(EMOJI)[0]
    .split(/[.!?|•]|\s[-–—]\s|:\s/)[0]
    .split(/\s+(?:is|are|was|has|have|will|that'?s|thats|that’s)\s+/i)[0]
    .replace(/\s+/g, ' ')
    .trim()
  for (let pass = 0; pass < 3; pass += 1) opening = opening.replace(LEAD_INS, '')
  for (let pass = 0; pass < 2; pass += 1) opening = opening.replace(TAIL_CHATTER, '')
  opening = opening.trim()
  const words = opening.split(/\s+/)
  if (opening.length < 3 || words.length > 8 || !hasDishWord(opening)) return undefined
  return opening
}

/** "#chickenwrap" won't do, but "#spaghetti" names the dish when nothing else does. */
function hashtagName(caption: string): string | undefined {
  for (const [, tag] of caption.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    const lower = tag.toLowerCase()
    if (!GENERIC_TAGS.test(tag) && (DISH_WORDS.has(lower) || FOOD_KEYWORDS.has(lower))) return tag
  }
  return undefined
}

export function titleFromCaption(caption: string): string | undefined {
  const raw = caption
    .replace(/\breplying\s+to\s+@[\w.]+/gi, ' ')
    .replace(/(^|\s)@[\w.]+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!raw) return undefined

  const text = raw.replace(/#[\p{L}\p{N}_]+/gu, ' ').replace(/\s+/g, ' ').trim()
  const intro = text.split(/\bingredients?\b/i)[0].slice(0, 400)

  const title =
    leadingName(text) ??
    titleBeforeIngredients(raw) ??
    namedInIntro(intro) ??
    openingClause(text) ??
    hashtagName(raw)

  return title ? finish(title) : undefined
}
