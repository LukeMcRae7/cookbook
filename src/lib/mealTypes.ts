import type { Ingredient, MealType } from '../types/recipe'

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'side', label: 'Sides' },
  { value: 'snack', label: 'Snacks' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drinks' },
]

export const MEAL_TYPE_LABEL: Record<MealType, string> = Object.fromEntries(
  MEAL_TYPES.map(({ value, label }) => [value, label]),
) as Record<MealType, string>

/**
 * Words that point at a meal. Multi-word entries are matched as phrases.
 * Deliberately short: a wrong guess costs a tap to fix, a missing one nothing.
 */
const SIGNALS: Record<MealType, string[]> = {
  breakfast: [
    'breakfast', 'brunch', 'pancake', 'pancakes', 'waffle', 'waffles', 'oatmeal',
    'overnight oats', 'granola', 'omelet', 'omelette', 'frittata', 'french toast',
    'scrambled eggs', 'eggs benedict', 'bagel', 'crepe', 'crepes', 'parfait',
    'hash brown', 'hash browns', 'breakfast burrito', 'shakshuka', 'porridge',
  ],
  lunch: [
    'lunch', 'sandwich', 'sandwiches', 'wrap', 'wraps', 'panini', 'quesadilla',
    'salad bowl', 'grain bowl', 'soup', 'toastie', 'sub', 'hoagie', 'blt',
  ],
  dinner: [
    'dinner', 'supper', 'weeknight', 'main', 'pasta', 'spaghetti', 'rigatoni',
    'lasagna', 'curry', 'stew', 'casserole', 'roast', 'steak', 'risotto',
    'stir fry', 'stir-fry', 'chili', 'enchiladas', 'tacos', 'pizza', 'salmon',
    'meatballs', 'pot roast', 'one pot', 'one-pot', 'sheet pan', 'tikka masala',
  ],
  side: [
    'side', 'side dish', 'sides', 'slaw', 'coleslaw', 'mashed potatoes',
    'roasted vegetables', 'roasted potatoes', 'garlic bread', 'cornbread',
    'rice pilaf', 'green beans', 'brussels sprouts', 'asparagus', 'fries',
    'potato salad', 'mac and cheese',
  ],
  snack: [
    'snack', 'snacks', 'dip', 'hummus', 'guacamole', 'salsa', 'popcorn',
    'energy balls', 'energy bites', 'protein balls', 'trail mix', 'nachos',
    'appetizer', 'appetizers', 'bites', 'crackers', 'chips',
  ],
  dessert: [
    'dessert', 'cookie', 'cookies', 'cake', 'cupcake', 'cupcakes', 'brownie',
    'brownies', 'blondies', 'pie', 'tart', 'cheesecake', 'pudding', 'ice cream',
    'fudge', 'cobbler', 'crumble', 'mousse', 'tiramisu', 'donut', 'donuts',
    'doughnut', 'macarons', 'custard', 'truffles', 'banana bread', 'sweet treat',
  ],
  drink: [
    'drink', 'drinks', 'smoothie', 'latte', 'coffee', 'iced coffee', 'tea',
    'matcha', 'chai', 'lemonade', 'cocktail', 'mocktail', 'margarita', 'juice',
    'milkshake', 'spritz', 'sangria', 'punch', 'hot chocolate',
  ],
}

/** Words that name the meal itself, rather than a dish that suggests it. */
const EXPLICIT: Record<MealType, string[]> = {
  breakfast: ['breakfast', 'brunch'],
  lunch: ['lunch'],
  dinner: ['dinner', 'supper'],
  side: ['side dish', 'sidedish'],
  snack: ['snack'],
  dessert: ['dessert'],
  drink: ['drink', 'cocktail', 'mocktail'],
}

function tokenize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
}

function countHits(haystack: string, words: string[]): number {
  return words.reduce((hits, word) => (haystack.includes(` ${word} `) ? hits + 1 : hits), 0)
}

export interface MealTypeHints {
  title?: string
  /** Hashtags or keywords, e.g. from a TikTok caption or a recipe site. */
  tags?: string[]
  /** schema.org recipeCategory values, which are the most reliable signal. */
  categories?: string[]
  ingredients?: Ingredient[]
}

/**
 * Guesses one or two meal types from the title, tags and category.
 * The title and explicit categories dominate; ingredients only break ties.
 */
export function classifyMealTypes(hints: MealTypeHints): MealType[] {
  const title = tokenize(hints.title ?? '')
  // "#familydinner" should count as "dinner": split camel-free tags into words
  // by also matching the signal as a substring of each tag.
  const tags = (hints.tags ?? []).map((tag) => tag.toLowerCase().replace(/^#/, ''))
  const categories = tokenize((hints.categories ?? []).join(' '))
  const ingredientText = tokenize((hints.ingredients ?? []).map((i) => i.name).join(' '))

  // A title or tag that names a meal outright ("Breakfast Sandwiches",
  // "#breakfastsandwich") speaks only for that meal; its dish word
  // ("sandwich") must not also vote for lunch.
  const namedMeals = (text: string): MealType[] =>
    MEAL_TYPES.filter(({ value }) => EXPLICIT[value].some((word) => text.includes(word))).map(
      ({ value }) => value,
    )
  const speaksFor = (text: string, meal: MealType) => {
    const named = namedMeals(text)
    return named.length === 0 || named.includes(meal)
  }

  const scores = MEAL_TYPES.map(({ value }) => {
    const words = SIGNALS[value]
    const tagHits = tags.filter(
      (tag) =>
        speaksFor(tag, value) &&
        words.some((word) => word.length >= 4 && tag.includes(word.replace(/[\s-]/g, ''))),
    ).length
    const score =
      countHits(categories, words) * 5 +
      (speaksFor(title, value) ? countHits(title, words) * 3 : 0) +
      // A hashtag is the creator saying what the dish is: as strong as the title.
      tagHits * 3 +
      Math.min(countHits(ingredientText, words), 1)
    return { value, score }
  })

  const best = Math.max(...scores.map((entry) => entry.score))
  if (best < 2) return []

  return scores
    .filter((entry) => entry.score >= Math.max(2, best * 0.5))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.value)
}

/** Pulls #hashtags out of raw caption text before cleaning removes them. */
export function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(/#([\p{L}\p{N}_]+)/gu), (match) => match[1])
}
