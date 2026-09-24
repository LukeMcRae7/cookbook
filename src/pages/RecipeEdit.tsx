import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BookIcon } from '../components/Icon'
import { RecipeEditor } from '../components/RecipeEditor'
import { EmptyState, emptyStateStyles } from '../components/EmptyState'
import { useRecipeStore } from '../state/RecipeStore'
import type { Recipe } from '../types/recipe'
import styles from './RecipeEdit.module.css'

export function RecipeEdit() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { getRecipe, saveRecipe, deleteRecipe } = useRecipeStore()
  const recipe = getRecipe(id)

  const justImported = Boolean(
    (location.state as { justImported?: boolean } | null)?.justImported,
  )

  if (!recipe) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<BookIcon size={30} />}
          title="Recipe not found"
          description="This recipe is not saved on this device, so there is nothing to edit."
        >
          <Link className={emptyStateStyles.action} to="/recipes">
            Back to your recipes
          </Link>
        </EmptyState>
      </div>
    )
  }

  function handleSave(updated: Recipe) {
    saveRecipe(updated)
    navigate(`/recipes/${updated.id}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.crumb}>
          <Link to={`/recipes/${recipe.id}`}>{recipe.title || 'Untitled recipe'}</Link>
        </p>
        <h1 className={styles.title}>Edit recipe</h1>
      </header>

      <RecipeEditor
        recipe={recipe}
        onSave={handleSave}
        onDelete={() => {
          deleteRecipe(recipe.id)
          navigate('/recipes')
        }}
        cancelHref={`/recipes/${recipe.id}`}
        banner={
          justImported
            ? 'Check what was imported, then save.'
            : undefined
        }
      />
    </div>
  )
}
