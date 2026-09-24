import { ClockIcon, FlameIcon, SparkIcon, StarIcon } from './Icon'
import { formatMinutes, totalTimeOf } from '../lib/recipe'
import type { Recipe } from '../types/recipe'
import styles from './RecipeMeta.module.css'

/** The metadata pills under the title. Anything unknown is simply omitted. */
export function RecipeMeta({ recipe }: { recipe: Recipe }) {
  const time = formatMinutes(totalTimeOf(recipe))

  const pills = [
    time
      ? {
          key: 'time',
          icon: <ClockIcon size={18} />,
          value: time,
          label: 'Time',
          tone: '',
          srLabel: `Total time ${time}`,
        }
      : null,
    recipe.calories
      ? {
          key: 'calories',
          icon: <FlameIcon size={18} />,
          value: String(recipe.calories),
          label: 'Calories',
          tone: styles.warm,
          srLabel: `${recipe.calories} calories`,
        }
      : null,
    recipe.difficulty
      ? {
          key: 'difficulty',
          icon: <SparkIcon size={18} />,
          value: recipe.difficulty,
          label: '',
          tone: styles.cool,
          srLabel: `Difficulty ${recipe.difficulty}`,
        }
      : null,
    recipe.rating
      ? {
          key: 'rating',
          icon: <StarIcon size={18} />,
          value: `${recipe.rating}/5`,
          label: 'Rating',
          tone: '',
          srLabel: `Rated ${recipe.rating} out of 5`,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string
    icon: JSX.Element
    value: string
    label: string
    tone: string
    srLabel: string
  }>

  if (pills.length === 0) return null

  return (
    <ul className={styles.meta}>
      {pills.map((pill) => (
        <li key={pill.key} className={`${styles.pill} ${pill.tone}`}>
          <span className={styles.icon} aria-hidden="true">
            {pill.icon}
          </span>
          <span aria-hidden="true">
            {pill.value}
            {pill.label ? <span className={styles.label}> {pill.label}</span> : null}
          </span>
          <span className="sr-only">{pill.srLabel}</span>
        </li>
      ))}
    </ul>
  )
}
