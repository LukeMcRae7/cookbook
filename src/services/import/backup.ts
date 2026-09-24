import type { Recipe } from '../../types/recipe'
import { ImportError } from './types'

function looksLikeRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Recipe>
  return (
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.ingredients) &&
    Array.isArray(candidate.directions)
  )
}

/**
 * Reads a cookbook JSON export (Settings → Export) back in. Accepts the bare
 * array the export writes, or { recipes: [...] }.
 */
export function parseBackup(json: string): Recipe[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new ImportError('unreadable', "That file isn't valid JSON.")
  }

  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { recipes?: unknown }).recipes)
      ? (data as { recipes: unknown[] }).recipes
      : []

  const recipes = list.filter(looksLikeRecipe)
  if (recipes.length === 0) {
    throw new ImportError('unreadable', "That file doesn't contain any cookbook recipes.")
  }
  return recipes
}
