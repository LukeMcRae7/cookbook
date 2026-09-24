import { useEffect, useState } from 'react'
import { CloseIcon, HeartIcon, SparkIcon } from './Icon'
import styles from './RecipeHero.module.css'

interface RecipeHeroProps {
  title: string
  thumbnailUrl?: string
  favorite: boolean
  onClose(): void
  onToggleFavorite(): void
  className?: string
}

export function RecipeHero({
  title,
  thumbnailUrl,
  favorite,
  onClose,
  onToggleFavorite,
  className,
}: RecipeHeroProps) {
  const [failed, setFailed] = useState(false)

  // A new recipe deserves a fresh attempt at its cover image.
  useEffect(() => setFailed(false), [thumbnailUrl])

  const showImage = Boolean(thumbnailUrl) && !failed

  return (
    <div className={`${styles.hero} ${className ?? ''}`}>
      {showImage ? (
        <img
          className={styles.image}
          src={thumbnailUrl}
          alt={`${title} cover image from TikTok`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.placeholder} role="img" aria-label={`No cover image for ${title}`}>
          <SparkIcon size={34} />
          <span className={styles.placeholderLabel}>No cover image</span>
        </div>
      )}

      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.circleButton}
          onClick={onClose}
          aria-label="Close recipe and go back"
        >
          <CloseIcon size={22} />
        </button>

        <button
          type="button"
          className={`${styles.circleButton} ${favorite ? styles.favoriteOn : styles.favorite}`}
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
        >
          <HeartIcon size={22} filled={favorite} />
        </button>
      </div>
    </div>
  )
}
