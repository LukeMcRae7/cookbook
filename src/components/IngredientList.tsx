import { CheckIcon, DragIcon } from './Icon'
import { formatIngredientAmount } from '../lib/recipe'
import type { Ingredient } from '../types/recipe'
import styles from './IngredientList.module.css'

interface IngredientRowProps {
  ingredient: Ingredient
  onToggle(checked: boolean): void
}

export function IngredientRow({ ingredient, onToggle }: IngredientRowProps) {
  const amount = formatIngredientAmount(ingredient)
  const inputId = `ingredient-${ingredient.id}`

  return (
    <li className={`${styles.row} ${ingredient.checked ? styles.checked : ''}`}>
      <label className={styles.label} htmlFor={inputId}>
        <span className={styles.grip} aria-hidden="true">
          <DragIcon size={18} />
        </span>

        <span className={styles.name}>
          {ingredient.name || 'Unnamed ingredient'}
          {ingredient.preparation ? (
            <span className={styles.prep}>, {ingredient.preparation}</span>
          ) : null}
        </span>

        <span className={styles.leader} aria-hidden="true" />

        <span className={amount ? styles.amount : `${styles.amount} ${styles.noAmount}`}>
          {amount || 'to taste'}
        </span>

        <input
          id={inputId}
          type="checkbox"
          className={styles.checkbox}
          checked={ingredient.checked}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className={styles.box} aria-hidden="true">
          <CheckIcon size={16} />
        </span>
      </label>
    </li>
  )
}

interface IngredientListProps {
  ingredients: Ingredient[]
  onToggle(id: string, checked: boolean): void
  onClear(): void
  scaled?: boolean
  servings?: number
}

export function IngredientList({
  ingredients,
  onToggle,
  onClear,
  scaled = false,
  servings,
}: IngredientListProps) {
  const checkedCount = ingredients.filter((ingredient) => ingredient.checked).length

  return (
    <div>
      {scaled ? (
        <p className={styles.scaleNote}>
          Quantities scaled for {servings} {servings === 1 ? 'serving' : 'servings'}.
        </p>
      ) : null}

      <ul className={styles.list}>
        {ingredients.map((ingredient) => (
          <IngredientRow
            key={ingredient.id}
            ingredient={ingredient}
            onToggle={(checked) => onToggle(ingredient.id, checked)}
          />
        ))}
      </ul>

      {ingredients.length > 0 ? (
        <div className={styles.footer}>
          <p className={styles.progress}>
            {checkedCount} of {ingredients.length} gathered
          </p>
          {checkedCount > 0 ? (
            <button type="button" className={styles.clear} onClick={onClear}>
              Uncheck all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
