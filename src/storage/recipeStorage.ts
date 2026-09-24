import type { Recipe } from '../types/recipe'

const RECIPES_KEY = 'cookbook.recipes.v1'
const SETTINGS_KEY = 'cookbook.settings.v1'
const SEEDED_KEY = 'cookbook.seeded.v1'

export interface AppSettings {
  /** Units shown in the recipe viewer. */
  temperatureUnit: 'F' | 'C'
  /** Keep checked ingredients ticked between visits. */
  rememberChecklist: boolean
  /**
   * Optional CORS relay for recipe sites that block browser reads, as a URL
   * template containing "{url}". Empty means the app only fetches directly.
   */
  corsRelay: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  temperatureUnit: 'F',
  rememberChecklist: true,
  corsRelay: '',
}

export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

function isStorageAvailable(): boolean {
  try {
    const probe = '__cookbook_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const UNAVAILABLE_MESSAGE =
  'This browser is blocking local storage (private mode or site data turned off), so recipes cannot be saved on this device.'

function readJson<T>(key: string): StorageResult<T | null> {
  if (!isStorageAvailable()) return { ok: false, message: UNAVAILABLE_MESSAGE }
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return { ok: true, data: null }
    return { ok: true, data: JSON.parse(raw) as T }
  } catch {
    return { ok: false, message: 'Saved data on this device is corrupted and could not be read.' }
  }
}

function writeJson(key: string, value: unknown): StorageResult<true> {
  if (!isStorageAvailable()) return { ok: false, message: UNAVAILABLE_MESSAGE }
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return { ok: true, data: true }
  } catch (error) {
    const quotaExceeded =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.code === 22)
    return {
      ok: false,
      message: quotaExceeded
        ? 'This device is out of local storage space. Delete a few recipes and try again.'
        : 'Could not save to this device.',
    }
  }
}

/** Defensive: anything read back from disk may be from an older build. */
function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Recipe>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.ingredients) &&
    Array.isArray(candidate.directions)
  )
}

function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    servings: Number(recipe.servings) > 0 ? Number(recipe.servings) : 1,
    favorite: Boolean(recipe.favorite),
    mealTypes: Array.isArray(recipe.mealTypes) ? recipe.mealTypes : [],
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: ingredient.id || `ing-${index}`,
      checked: Boolean(ingredient.checked),
    })),
    directions: recipe.directions.map((direction, index) => ({
      ...direction,
      id: direction.id || `dir-${index}`,
      step: index + 1,
    })),
  }
}

export const recipeStorage = {
  loadAll(): StorageResult<Recipe[]> {
    const result = readJson<unknown[]>(RECIPES_KEY)
    if (!result.ok) return result
    if (!Array.isArray(result.data)) return { ok: true, data: [] }
    return {
      ok: true,
      data: result.data.filter(isRecipe).map(normalizeRecipe),
    }
  },

  saveAll(recipes: Recipe[]): StorageResult<true> {
    return writeJson(RECIPES_KEY, recipes)
  },

  loadSettings(): AppSettings {
    const result = readJson<Partial<AppSettings>>(SETTINGS_KEY)
    if (!result.ok || !result.data) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...result.data }
  },

  saveSettings(settings: AppSettings): StorageResult<true> {
    return writeJson(SETTINGS_KEY, settings)
  },

  clearAll(): StorageResult<true> {
    if (!isStorageAvailable()) return { ok: false, message: UNAVAILABLE_MESSAGE }
    window.localStorage.removeItem(RECIPES_KEY)
    return { ok: true, data: true }
  },

  /** True once the demo recipes have been offered on this device. */
  hasSeeded(): boolean {
    try {
      return window.localStorage.getItem(SEEDED_KEY) === '1'
    } catch {
      return true
    }
  },

  markSeeded(): void {
    try {
      window.localStorage.setItem(SEEDED_KEY, '1')
    } catch {
      // Nothing to do: without storage the app runs in-memory for this visit.
    }
  },

  isAvailable: isStorageAvailable,
}
