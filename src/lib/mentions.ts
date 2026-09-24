import type { Ingredient } from '../types/recipe'
import { FOOD_KEYWORDS } from '../services/parser/vocabulary'

/**
 * Finding ingredients mentioned in a step, so the step can show what "the
 * chicken" means in the ingredients list.
 *
 * Steps rarely repeat an ingredient's full name. "2 boneless skinless chicken
 * breasts" is "the chicken" in step 3 and "olive oil" is "the oil", so each
 * ingredient is matched by its full name and by the shorter names people use
 * for it. The longest match wins; a phrase that fits two ingredients (paprika
 * for the chicken and paprika for the sauce) points at both.
 */

export interface Mention {
  start: number
  end: number
  ingredients: Ingredient[]
}

/** Words that describe an ingredient rather than name it. */
const DESCRIPTORS = new Set([
  'fresh', 'freshly', 'dried', 'dry', 'boneless', 'skinless', 'large', 'small',
  'medium', 'extra', 'virgin', 'plain', 'unsalted', 'salted', 'ground', 'whole',
  'chopped', 'minced', 'diced', 'sliced', 'grated', 'shredded', 'cooked',
  'uncooked', 'frozen', 'canned', 'lean', 'ripe', 'raw', 'cold', 'warm', 'hot',
  'thick', 'thin', 'reduced', 'sodium', 'low', 'fat', 'light', 'heavy',
])

/** The part of a food that stands for the whole: "chicken breasts" -> "chicken". */
const CUTS = new Set([
  'breast', 'breasts', 'thigh', 'thighs', 'wing', 'wings', 'fillet', 'fillets',
  'filet', 'filets', 'clove', 'cloves', 'bulb', 'bulbs', 'leaves', 'sprigs',
  'stalks', 'florets', 'cubes', 'strips', 'slices', 'pieces', 'side', 'loin',
])

/** Too vague to stand in for one ingredient on their own: "the sauce", "the mixture". */
const VAGUE = new Set([
  'sauce', 'mixture', 'mix', 'seasoning', 'spice', 'spices', 'powder', 'flakes',
  'seeds', 'leaves', 'extract', 'paste', 'juice', 'zest', 'cheese', 'mayo',
])

function variants(phrase: string): string[] {
  const out = new Set([phrase])
  if (/ies$/.test(phrase)) out.add(phrase.replace(/ies$/, 'y'))
  else if (/y$/.test(phrase)) out.add(phrase.replace(/y$/, 'ies'))
  if (/oes$/.test(phrase)) out.add(phrase.replace(/es$/, ''))
  else if (/o$/.test(phrase)) out.add(`${phrase}es`)
  if (/s$/.test(phrase) && !/ss$/.test(phrase)) out.add(phrase.replace(/s$/, ''))
  else out.add(`${phrase}s`)
  return Array.from(out)
}

/** Every name a step might use for this ingredient, longest first. */
export function namesFor(ingredient: Ingredient): string[] {
  const words = ingredient.name
    .toLowerCase()
    .replace(/[^a-z\s&'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return []

  const names = new Set<string>()
  const add = (phrase: string) => {
    if (phrase.length >= 3) variants(phrase).forEach((variant) => names.add(variant))
  }

  // "salt and black pepper", "linguine or bucatini": each alternative is a name.
  const alternatives = words.join(' ').split(/\s+(?:and|or|&)\s+/)
  for (const alternative of alternatives) {
    const parts = alternative.split(' ')
    add(alternative)
    const core = parts.filter((word) => !DESCRIPTORS.has(word))
    if (core.length) add(core.join(' '))
    // Trailing sub-phrases: "extra virgin olive oil" -> "olive oil" -> "oil"
    for (let i = 1; i < core.length; i += 1) {
      const tail = core.slice(i)
      if (tail.length === 1 && VAGUE.has(tail[0])) continue
      add(tail.join(' '))
    }
    // "chicken breasts" -> "chicken", "garlic cloves" -> "garlic"
    if (core.length >= 2 && CUTS.has(core[core.length - 1]) && FOOD_KEYWORDS.has(core[core.length - 2])) {
      add(core[core.length - 2])
    }
  }
  return Array.from(names).sort((a, b) => b.length - a.length)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findIngredientMentions(text: string, ingredients: Ingredient[]): Mention[] {
  const lower = text.toLowerCase()
  const hits: Mention[] = []

  for (const ingredient of ingredients) {
    for (const name of namesFor(ingredient)) {
      const pattern = new RegExp(`(?<![a-z])${escapeRegExp(name)}(?![a-z])`, 'g')
      for (const match of lower.matchAll(pattern)) {
        const start = match.index ?? 0
        hits.push({ start, end: start + name.length, ingredients: [ingredient] })
      }
    }
  }

  // Longest spans first; merge identical spans; drop anything overlapping a kept span.
  hits.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start)
  const kept: Mention[] = []
  for (const hit of hits) {
    const same = kept.find((mention) => mention.start === hit.start && mention.end === hit.end)
    if (same) {
      if (!same.ingredients.some((item) => item.id === hit.ingredients[0].id)) same.ingredients.push(...hit.ingredients)
      continue
    }
    if (kept.some((mention) => hit.start < mention.end && mention.start < hit.end)) continue
    kept.push({ ...hit, ingredients: [...hit.ingredients] })
  }

  // When a name belongs to several ingredients, only a longer, more specific
  // ingredient name should win it: "oil" for a recipe with olive oil and
  // sesame oil points at both, which is honest.
  return kept.sort((a, b) => a.start - b.start)
}
