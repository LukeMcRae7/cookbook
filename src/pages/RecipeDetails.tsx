import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LinkIcon, PencilIcon } from '../components/Icon'
import { RecipeHero } from '../components/RecipeHero'
import { RecipeMeta } from '../components/RecipeMeta'
import { ServingSelector } from '../components/ServingSelector'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { IngredientList } from '../components/IngredientList'
import { DirectionList } from '../components/DirectionList'
import { EmptyState, emptyStateStyles } from '../components/EmptyState'
import { BookIcon } from '../components/Icon'
import { useRecipeStore } from '../state/RecipeStore'
import { scaledIngredients } from '../lib/recipe'
import styles from './RecipeDetails.module.css'

type Tab = 'ingredients' | 'directions'

export function RecipeDetails() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { getRecipe, toggleFavorite, setIngredientChecked, clearChecklist, settings } =
    useRecipeStore()
  const recipe = getRecipe(id)

  const [tab, setTab] = useState<Tab>('ingredients')
  const [servings, setServings] = useState<number | null>(null)

  // React Router reuses this component across recipes, so per-recipe view
  // state has to be reset by hand.
  useEffect(() => {
    setServings(null)
    setTab('ingredients')
  }, [id])

  // When the cook opted out of a sticky checklist, wipe it on the way out.
  const rememberChecklist = settings.rememberChecklist
  useEffect(() => {
    if (rememberChecklist) return
    return () => clearChecklist(id)
  }, [id, rememberChecklist, clearChecklist])

  if (!recipe) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<BookIcon size={30} />}
          title="Recipe not found"
          description="This recipe is not saved on this device. It may have been deleted, or saved in a different browser."
        >
          <Link className={emptyStateStyles.action} to="/recipes">
            Back to your recipes
          </Link>
        </EmptyState>
      </div>
    )
  }

  const activeServings = servings ?? recipe.servings
  const isScaled = activeServings !== recipe.servings
  const ingredients = scaledIngredients(recipe, activeServings)

  return (
    <div className={styles.page}>
      <article className={styles.card}>
        <RecipeHero
          className={styles.hero}
          title={recipe.title}
          thumbnailUrl={recipe.thumbnailUrl}
          favorite={recipe.favorite}
          onClose={() => navigate('/recipes')}
          onToggleFavorite={() => toggleFavorite(recipe.id)}
        />

        <div className={styles.content}>
          <div className={styles.grabber} aria-hidden="true" />

          <header className={styles.titleBlock}>
            <h1 className={styles.title}>{recipe.title}</h1>
            {recipe.author ? <p className={styles.author}>{recipe.author}</p> : null}
          </header>

          <div className={styles.controlRow}>
            <ServingSelector
              servings={activeServings}
              baseServings={recipe.servings}
              onChange={setServings}
            />
            <RecipeMeta recipe={recipe} />
          </div>

          <div className={styles.tabsWrap}>
            <SegmentedTabs<Tab>
              label="Recipe sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'ingredients', label: 'Ingredients', count: ingredients.length },
                { value: 'directions', label: 'Directions', count: recipe.directions.length },
              ]}
            />
          </div>

          <div
            className={styles.panel}
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
          >
            {tab === 'ingredients' ? (
              ingredients.length > 0 ? (
                <IngredientList
                  ingredients={ingredients}
                  scaled={isScaled}
                  servings={activeServings}
                  onToggle={(ingredientId, checked) =>
                    setIngredientChecked(recipe.id, ingredientId, checked)
                  }
                  onClear={() => clearChecklist(recipe.id)}
                />
              ) : (
                <p className={styles.missing}>
                  No ingredients yet. Edit the recipe to add them.
                </p>
              )
            ) : recipe.directions.length > 0 ? (
              <DirectionList
                directions={recipe.directions}
                recipeId={recipe.id}
                temperatureUnit={settings.temperatureUnit}
                ingredients={ingredients}
              />
            ) : (
              <p className={styles.missing}>No steps yet. Edit the recipe to add them.</p>
            )}
          </div>

          {recipe.notes ? (
            <section className={styles.notes}>
              <h2 className={styles.notesTitle}>Notes</h2>
              <p className={styles.notesText}>{recipe.notes}</p>
            </section>
          ) : null}

          <div className={styles.footerRow}>
            <Link className={styles.footerLink} to={`/recipes/${recipe.id}/edit`}>
              <PencilIcon size={16} />
              Edit recipe
            </Link>
            {recipe.sourceUrl ? (
              <a
                className={styles.footerLink}
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <LinkIcon size={16} />
                Open on TikTok
              </a>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  )
}
