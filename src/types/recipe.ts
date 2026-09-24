export type TemperatureUnit = 'F' | 'C'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'
export type MealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'side'
  | 'snack'
  | 'dessert'
  | 'drink'

export interface Ingredient {
  id: string
  /** Numeric quantity for the recipe's *base* servings. Undefined when none was stated. */
  quantity?: number
  /** Pretty, human-facing quantity ("1 1/2"). Derived from `quantity` when scaling. */
  displayQuantity?: string
  unit?: string
  name: string
  preparation?: string
  /** The part of the recipe it belongs to: "Spicy mayo", "For the dough". */
  group?: string
  checked: boolean
}

export interface Temperature {
  value: number
  unit: TemperatureUnit
}

export interface Direction {
  id: string
  step: number
  text: string
  timerSeconds?: number
  temperature?: Temperature
  /** A named stage of the method: "Sauce", "Reheat (from frozen)". */
  section?: string
}

export interface Recipe {
  id: string
  title: string
  author?: string
  sourceUrl: string
  thumbnailUrl?: string
  servings: number
  prepTime?: number
  cookTime?: number
  /** Minutes. */
  totalTime?: number
  calories?: number
  rating?: number
  difficulty?: Difficulty
  /** Which meals this fits. Drives the library filter chips. */
  mealTypes?: MealType[]
  ingredients: Ingredient[]
  directions: Direction[]
  notes?: string
  createdAt: string
  updatedAt: string
  favorite: boolean
}

export type ParseWarning =
  | 'empty-transcript'
  | 'no-ingredients'
  | 'no-directions'
  | 'no-recipe-content'
  | 'missing-quantities'

export interface ParsedRecipe {
  title?: string
  servings?: number
  /** Minutes, summed from recognised durations. */
  totalTime?: number
  calories?: number
  ingredients: Ingredient[]
  directions: Direction[]
  /** Tips / variations blocks found alongside the recipe. */
  notes?: string
  warnings: ParseWarning[]
  /** 0–1 rough signal used to decide how loudly to warn the user. */
  confidence: number
}
