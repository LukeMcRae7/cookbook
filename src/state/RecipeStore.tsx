import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Recipe } from '../types/recipe'
import { demoRecipes } from '../data/demoRecipes'
import { createId } from '../lib/recipe'
import {
  DEFAULT_SETTINGS,
  recipeStorage,
  type AppSettings,
} from '../storage/recipeStorage'

interface RecipeStoreValue {
  recipes: Recipe[]
  settings: AppSettings
  /** Set when localStorage is unavailable or a write failed. */
  storageError: string | null
  ready: boolean
  getRecipe(id: string): Recipe | undefined
  saveRecipe(recipe: Recipe): Recipe
  deleteRecipe(id: string): void
  toggleFavorite(id: string): void
  setIngredientChecked(recipeId: string, ingredientId: string, checked: boolean): void
  clearChecklist(recipeId: string): void
  updateSettings(patch: Partial<AppSettings>): void
  restoreDemoRecipes(): void
  /** Adds recipes from a backup; returns how many were added. */
  importRecipes(recipes: Recipe[]): number
  deleteAllRecipes(): void
  dismissStorageError(): void
}

const RecipeStoreContext = createContext<RecipeStoreValue | null>(null)

export function RecipeStoreProvider({ children }: { children: ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  // Skip the persist effect on the very first render, before load finishes.
  const loaded = useRef(false)

  useEffect(() => {
    // StrictMode runs effects twice in development; seeding must not repeat.
    if (loaded.current) return
    const result = recipeStorage.loadAll()
    if (!result.ok) {
      setStorageError(result.message)
      setRecipes(demoRecipes())
    } else if (result.data.length === 0 && !recipeStorage.hasSeeded()) {
      setRecipes(demoRecipes())
      recipeStorage.markSeeded()
    } else {
      setRecipes(result.data)
    }
    setSettings(recipeStorage.loadSettings())
    loaded.current = true
    setReady(true)
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    const result = recipeStorage.saveAll(recipes)
    if (!result.ok) setStorageError(result.message)
  }, [recipes])

  useEffect(() => {
    if (!loaded.current) return
    recipeStorage.saveSettings(settings)
  }, [settings])

  const getRecipe = useCallback(
    (id: string) => recipes.find((recipe) => recipe.id === id),
    [recipes],
  )

  const saveRecipe = useCallback((recipe: Recipe) => {
    const stamped: Recipe = { ...recipe, updatedAt: new Date().toISOString() }
    setRecipes((current) => {
      const index = current.findIndex((item) => item.id === stamped.id)
      if (index === -1) return [stamped, ...current]
      const next = [...current]
      next[index] = stamped
      return next
    })
    recipeStorage.markSeeded()
    return stamped
  }, [])

  const deleteRecipe = useCallback((id: string) => {
    setRecipes((current) => current.filter((recipe) => recipe.id !== id))
  }, [])

  const patchRecipe = useCallback(
    (id: string, patch: (recipe: Recipe) => Recipe) => {
      setRecipes((current) =>
        current.map((recipe) => (recipe.id === id ? patch(recipe) : recipe)),
      )
    },
    [],
  )

  const toggleFavorite = useCallback(
    (id: string) => {
      patchRecipe(id, (recipe) => ({
        ...recipe,
        favorite: !recipe.favorite,
        updatedAt: new Date().toISOString(),
      }))
    },
    [patchRecipe],
  )

  const setIngredientChecked = useCallback(
    (recipeId: string, ingredientId: string, checked: boolean) => {
      patchRecipe(recipeId, (recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) =>
          ingredient.id === ingredientId ? { ...ingredient, checked } : ingredient,
        ),
      }))
    },
    [patchRecipe],
  )

  const clearChecklist = useCallback(
    (recipeId: string) => {
      patchRecipe(recipeId, (recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) => ({
          ...ingredient,
          checked: false,
        })),
      }))
    },
    [patchRecipe],
  )

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const restoreDemoRecipes = useCallback(() => {
    setRecipes((current) => {
      const existing = new Set(current.map((recipe) => recipe.id))
      const missing = demoRecipes().filter((recipe) => !existing.has(recipe.id))
      return [...current, ...missing]
    })
  }, [])

  const importRecipes = useCallback((incoming: Recipe[]) => {
    const fresh = incoming.map((recipe) => ({
      ...recipe,
      // New ids, so importing the same backup twice never overwrites anything.
      id: createId(),
      favorite: Boolean(recipe.favorite),
      mealTypes: Array.isArray(recipe.mealTypes) ? recipe.mealTypes : [],
      ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient, checked: false })),
    }))
    setRecipes((current) => [...fresh, ...current])
    recipeStorage.markSeeded()
    return fresh.length
  }, [])

  const deleteAllRecipes = useCallback(() => {
    setRecipes([])
    recipeStorage.markSeeded()
  }, [])

  const value = useMemo<RecipeStoreValue>(
    () => ({
      recipes,
      settings,
      storageError,
      ready,
      getRecipe,
      saveRecipe,
      deleteRecipe,
      toggleFavorite,
      setIngredientChecked,
      clearChecklist,
      updateSettings,
      restoreDemoRecipes,
      importRecipes,
      deleteAllRecipes,
      dismissStorageError: () => setStorageError(null),
    }),
    [
      recipes,
      settings,
      storageError,
      ready,
      getRecipe,
      saveRecipe,
      deleteRecipe,
      toggleFavorite,
      setIngredientChecked,
      clearChecklist,
      updateSettings,
      restoreDemoRecipes,
      importRecipes,
      deleteAllRecipes,
    ],
  )

  return (
    <RecipeStoreContext.Provider value={value}>{children}</RecipeStoreContext.Provider>
  )
}

export function useRecipeStore(): RecipeStoreValue {
  const context = useContext(RecipeStoreContext)
  if (!context) {
    throw new Error('useRecipeStore must be used inside a RecipeStoreProvider')
  }
  return context
}
