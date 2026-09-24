import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClockIcon, HeartIcon, PencilIcon, SparkIcon, TrashIcon } from './Icon'
import { formatMinutes, totalTimeOf } from '../lib/recipe'
import { MEAL_TYPE_LABEL } from '../lib/mealTypes'
import type { Recipe } from '../types/recipe'
import styles from './RecipeCard.module.css'

interface RecipeCardProps {
  recipe: Recipe
  onToggleFavorite(id: string): void
  onDelete(id: string): void
}

export function RecipeCard({ recipe, onToggleFavorite, onDelete }: RecipeCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const time = formatMinutes(totalTimeOf(recipe))
  const showImage = Boolean(recipe.thumbnailUrl) && !imageFailed

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {showImage ? (
          <img
            className={styles.image}
            src={recipe.thumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <SparkIcon size={30} />
          </div>
        )}

        <button
          type="button"
          className={`${styles.heart} ${recipe.favorite ? styles.heartOn : ''}`}
          onClick={() => onToggleFavorite(recipe.id)}
          aria-pressed={recipe.favorite}
          aria-label={
            recipe.favorite
              ? `Remove ${recipe.title} from favourites`
              : `Add ${recipe.title} to favourites`
          }
        >
          <HeartIcon size={20} filled={recipe.favorite} />
        </button>
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link className={styles.titleLink} to={`/recipes/${recipe.id}`}>
            {recipe.title || 'Untitled recipe'}
          </Link>
        </h3>

        {recipe.author ? <p className={styles.author}>{recipe.author}</p> : null}

        <div className={styles.facts}>
          {time ? (
            <span className={styles.fact}>
              <ClockIcon size={14} />
              {time}
            </span>
          ) : null}
          <span className={styles.fact}>
            {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
          </span>
          {recipe.mealTypes?.[0] ? (
            <span className={styles.fact}>{MEAL_TYPE_LABEL[recipe.mealTypes[0]]}</span>
          ) : null}
        </div>
      </div>

      <div className={styles.actions}>
        {confirmingDelete ? (
          <>
            <button
              type="button"
              className={`${styles.action} ${styles.confirm}`}
              onClick={() => onDelete(recipe.id)}
            >
              Delete for good
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <Link className={styles.action} to={`/recipes/${recipe.id}/edit`}>
              <PencilIcon size={16} />
              Edit
            </Link>
            <button
              type="button"
              className={`${styles.action} ${styles.danger}`}
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${recipe.title}`}
            >
              <TrashIcon size={16} />
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  )
}
