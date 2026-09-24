import { MinusIcon, PlusIcon } from './Icon'
import styles from './ServingSelector.module.css'

interface ServingSelectorProps {
  servings: number
  baseServings: number
  onChange(servings: number): void
  min?: number
  max?: number
}

export function ServingSelector({
  servings,
  baseServings,
  onChange,
  min = 1,
  max = 48,
}: ServingSelectorProps) {
  const scaled = servings !== baseServings

  return (
    <div className={styles.selector}>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.max(min, servings - 1))}
        disabled={servings <= min}
        aria-label="Decrease servings"
      >
        <MinusIcon size={18} />
      </button>

      <p className={styles.value} aria-live="polite">
        <span className={`${styles.count} ${scaled ? styles.scaled : ''}`}>{servings}</span>
        <span className={styles.label}>{servings === 1 ? 'serving' : 'servings'}</span>
      </p>

      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.min(max, servings + 1))}
        disabled={servings >= max}
        aria-label="Increase servings"
      >
        <PlusIcon size={18} />
      </button>
    </div>
  )
}
