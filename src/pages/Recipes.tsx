import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookIcon, HeartIcon, PlusIcon } from '../components/Icon'
import { RecipeCard } from '../components/RecipeCard'
import { EmptyState, emptyStateStyles } from '../components/EmptyState'
import { SearchBar } from '../components/SearchBar'
import { useRecipeStore } from '../state/RecipeStore'
import { MEAL_TYPES } from '../lib/mealTypes'
import type { MealType, Recipe } from '../types/recipe'
import styles from './Recipes.module.css'

type SortKey = 'recent' | 'title' | 'time'

const QUICK_MINUTES = 30

const isQuick = (recipe: Recipe) => (recipe.totalTime ?? Infinity) <= QUICK_MINUTES

export function Recipes() {
  const { recipes, toggleFavorite, deleteRecipe, restoreDemoRecipes } = useRecipeStore()
  const [query, setQuery] = useState('')
  const [meal, setMeal] = useState<MealType | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [quickOnly, setQuickOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('recent')

  const mealCounts = useMemo(() => {
    const counts = new Map<MealType, number>()
    for (const recipe of recipes) {
      for (const type of recipe.mealTypes ?? []) counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    return counts
  }, [recipes])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return recipes
      .filter((recipe) => {
        if (favoritesOnly && !recipe.favorite) return false
        if (quickOnly && !isQuick(recipe)) return false
        if (meal && !(recipe.mealTypes ?? []).includes(meal)) return false
        if (!needle) return true
        return (
          recipe.title.toLowerCase().includes(needle) ||
          (recipe.author ?? '').toLowerCase().includes(needle) ||
          recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(needle))
        )
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title)
        if (sort === 'time') return (a.totalTime ?? 9999) - (b.totalTime ?? 9999)
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [recipes, query, meal, favoritesOnly, quickOnly, sort])

  const filtered = Boolean(query || meal || favoritesOnly || quickOnly)

  function clearFilters() {
    setQuery('')
    setMeal(null)
    setFavoritesOnly(false)
    setQuickOnly(false)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Recipes</h1>
        <Link className={styles.newButton} to="/">
          <PlusIcon size={17} />
          Add
        </Link>
      </header>

      {recipes.length > 0 ? (
        <div className={styles.controls}>
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <SearchBar value={query} onChange={setQuery} placeholder="Search recipes or ingredients" />
            </div>
            <label className="sr-only" htmlFor="recipe-sort">
              Sort
            </label>
            <select
              id="recipe-sort"
              className={styles.sort}
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="recent">Newest</option>
              <option value="title">A–Z</option>
              <option value="time">Quickest</option>
            </select>
          </div>

          <div className={styles.chips} role="group" aria-label="Filter recipes">
            <button
              type="button"
              className={`${styles.chip} ${!filtered ? styles.chipOn : ''}`}
              aria-pressed={!filtered}
              onClick={clearFilters}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.chip} ${favoritesOnly ? styles.chipOn : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((on) => !on)}
            >
              <HeartIcon size={14} filled={favoritesOnly} />
              Favourites
            </button>
            <button
              type="button"
              className={`${styles.chip} ${quickOnly ? styles.chipOn : ''}`}
              aria-pressed={quickOnly}
              onClick={() => setQuickOnly((on) => !on)}
            >
              Under {QUICK_MINUTES} min
            </button>

            <span className={styles.chipDivider} aria-hidden="true" />

            {MEAL_TYPES.filter(({ value }) => mealCounts.has(value)).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.chip} ${meal === value ? styles.chipOn : ''}`}
                aria-pressed={meal === value}
                onClick={() => setMeal((current) => (current === value ? null : value))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className={styles.grid}>
          {visible.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onToggleFavorite={toggleFavorite}
              onDelete={deleteRecipe}
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={30} />}
          title="No recipes yet"
          description="Add one from a TikTok, a recipe site or a screenshot."
        >
          <Link className={emptyStateStyles.action} to="/">
            Add a recipe
          </Link>
          <button
            type="button"
            className={`${emptyStateStyles.action} ${emptyStateStyles.secondary}`}
            onClick={restoreDemoRecipes}
          >
            Load demo recipes
          </button>
        </EmptyState>
      ) : (
        <EmptyState icon={<BookIcon size={30} />} title="Nothing matches" description="Try another search or filter.">
          <button type="button" className={emptyStateStyles.action} onClick={clearFilters}>
            Clear filters
          </button>
        </EmptyState>
      )}
    </div>
  )
}
