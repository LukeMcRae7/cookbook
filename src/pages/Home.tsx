import { Link, useLocation } from 'react-router-dom'
import { RecipeImporter } from '../components/RecipeImporter'
import { RecipeCard } from '../components/RecipeCard'
import { useRecipeStore } from '../state/RecipeStore'
import type { ImportResult } from '../services/import'
import styles from './Home.module.css'

export function Home() {
  const location = useLocation()
  // Set by the "Save to cookbook" bookmark via /import.
  const initialResult = (location.state as { importResult?: ImportResult } | null)?.importResult
  const { recipes, toggleFavorite, deleteRecipe } = useRecipeStore()
  const recent = [...recipes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)

  return (
    <div className={styles.page}>
      <section className={styles.add} aria-labelledby="add-title">
        <h1 className={styles.title} id="add-title">
          Add a recipe
        </h1>
        <RecipeImporter initialResult={initialResult} />
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-title">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle} id="recent-title">
              Recent
            </h2>
            <Link className={styles.sectionLink} to="/recipes">
              All recipes
            </Link>
          </div>
          <div className={styles.cardGrid}>
            {recent.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteRecipe}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
