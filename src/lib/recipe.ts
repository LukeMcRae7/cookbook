import type {
  Direction,
  Ingredient,
  ParsedRecipe,
  Recipe,
  Temperature,
  TemperatureUnit,
} from '../types/recipe'
import { formatQuantity } from '../services/parser/numberParser'
import { formatUnit } from '../services/parser/units'

export function createId(prefix = 'r'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

export function emptyIngredient(): Ingredient {
  return { id: createId('ing'), name: '', checked: false }
}

export function emptyDirection(step: number): Direction {
  return { id: createId('dir'), step, text: '' }
}

export interface RecipeSeed {
  sourceUrl: string
  title?: string
  author?: string
  thumbnailUrl?: string
  notes?: string
}

export function createRecipeFromParsed(
  parsed: ParsedRecipe,
  seed: RecipeSeed,
): Recipe {
  const now = new Date().toISOString()
  const servings = parsed.servings ?? 2

  return {
    id: createId(),
    title: seed.title?.trim() || parsed.title?.trim() || 'Untitled recipe',
    author: seed.author,
    sourceUrl: seed.sourceUrl,
    thumbnailUrl: seed.thumbnailUrl,
    servings,
    totalTime: parsed.totalTime,
    difficulty: 'Easy',
    ingredients: parsed.ingredients.length ? parsed.ingredients : [emptyIngredient()],
    directions: parsed.directions.length ? parsed.directions : [emptyDirection(1)],
    notes: seed.notes ?? parsed.notes,
    createdAt: now,
    updatedAt: now,
    favorite: false,
  }
}

export function blankRecipe(): Recipe {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: '',
    sourceUrl: '',
    servings: 2,
    difficulty: 'Easy',
    ingredients: [emptyIngredient()],
    directions: [emptyDirection(1)],
    createdAt: now,
    updatedAt: now,
    favorite: false,
  }
}

/** Ingredients rescaled for the servings the cook actually wants. */
export function scaledIngredients(recipe: Recipe, servings: number): Ingredient[] {
  const base = recipe.servings > 0 ? recipe.servings : 1
  const factor = servings / base
  if (factor === 1) return recipe.ingredients

  return recipe.ingredients.map((ingredient) =>
    ingredient.quantity === undefined
      ? ingredient
      : {
          ...ingredient,
          quantity: ingredient.quantity * factor,
          displayQuantity: formatQuantity(ingredient.quantity * factor),
        },
  )
}

/** "1 1/2 cups" — the right-hand column of the ingredient list. */
export function formatIngredientAmount(ingredient: Ingredient): string {
  const amount =
    ingredient.displayQuantity ??
    (ingredient.quantity !== undefined ? formatQuantity(ingredient.quantity) : '')
  const unit = formatUnit(ingredient.unit, ingredient.quantity)
  return [amount, unit].filter(Boolean).join(' ')
}

export function formatIngredientName(ingredient: Ingredient): string {
  return ingredient.preparation
    ? `${ingredient.name}, ${ingredient.preparation}`
    : ingredient.name
}

/** 45 -> "45m", 95 -> "1h 35m" */
export function formatMinutes(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return ''
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/** 1500 -> "25:00" */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

/** Renders a temperature in the cook's preferred scale, converting if needed. */
export function formatTemperature(
  temperature: Temperature,
  preferred: TemperatureUnit,
): string {
  if (temperature.unit === preferred) {
    return `${Math.round(temperature.value)}°${preferred}`
  }
  const converted =
    preferred === 'C'
      ? ((temperature.value - 32) * 5) / 9
      : (temperature.value * 9) / 5 + 32
  return `${Math.round(converted)}°${preferred}`
}

export function totalTimeOf(recipe: Recipe): number | undefined {
  if (recipe.totalTime) return recipe.totalTime
  const parts = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)
  return parts > 0 ? parts : undefined
}

/**
 * Consecutive runs of items that share a label: groups in an ingredient list,
 * sections in a method. Items without a label form their own unlabelled run.
 */
export function runsBy<T>(items: T[], label: (item: T) => string | undefined): { label?: string; items: T[] }[] {
  const runs: { label?: string; items: T[] }[] = []
  for (const item of items) {
    const name = label(item)?.trim() || undefined
    const last = runs[runs.length - 1]
    if (last && last.label === name) last.items.push(item)
    else runs.push({ label: name, items: [item] })
  }
  return runs
}

export function renumber(directions: Direction[]): Direction[] {
  return directions.map((direction, index) => ({ ...direction, step: index + 1 }))
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
