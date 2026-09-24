import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from './Icon'
import { parseNumericToken } from '../services/parser/numberParser'
import { ALL_UNITS } from '../services/parser/units'
import { emptyDirection, emptyIngredient, moveItem, renumber } from '../lib/recipe'
import { MEAL_TYPES } from '../lib/mealTypes'
import type { Difficulty, Direction, Ingredient, Recipe } from '../types/recipe'
import styles from './RecipeEditor.module.css'

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard']

interface RecipeEditorProps {
  recipe: Recipe
  onSave(recipe: Recipe): void
  onDelete?(): void
  cancelHref: string
  banner?: string
}

/** Numbers typed as "1 1/2" or "0.5" both need to end up numeric. */
function toQuantity(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const parts = trimmed.split(/\s+/)
  const total = parts.reduce<number | null>((sum, part) => {
    if (sum === null) return null
    const value = parseNumericToken(part)
    return value === null ? null : sum + value
  }, 0)
  return total === null || total <= 0 ? undefined : total
}

function toOptionalNumber(raw: string): number | undefined {
  const value = Number(raw)
  return raw.trim() && Number.isFinite(value) && value > 0 ? value : undefined
}

export function RecipeEditor({
  recipe,
  onSave,
  onDelete,
  cancelHref,
  banner,
}: RecipeEditorProps) {
  const [draft, setDraft] = useState<Recipe>(recipe)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const patch = (changes: Partial<Recipe>) =>
    setDraft((current) => ({ ...current, ...changes }))

  const patchIngredient = (id: string, changes: Partial<Ingredient>) =>
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...changes } : ingredient,
      ),
    }))

  const patchDirection = (id: string, changes: Partial<Direction>) =>
    setDraft((current) => ({
      ...current,
      directions: current.directions.map((direction) =>
        direction.id === id ? { ...direction, ...changes } : direction,
      ),
    }))

  const distinct = (values: (string | undefined)[]) =>
    Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
  const groupNames = distinct(draft.ingredients.map((ingredient) => ingredient.group))
  const sectionNames = distinct(draft.directions.map((direction) => direction.section))

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cleaned: Recipe = {
      ...draft,
      title: draft.title.trim() || 'Untitled recipe',
      ingredients: draft.ingredients.filter((ingredient) => ingredient.name.trim()),
      directions: renumber(draft.directions.filter((direction) => direction.text.trim())),
    }
    onSave(cleaned)
    setSavedAt(Date.now())
  }

  return (
    <form className={styles.editor} onSubmit={handleSubmit}>
      {banner ? <p className={styles.banner}>{banner}</p> : null}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Recipe details</h2>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.span2}`}>
            <label className={styles.label} htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className={styles.input}
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="Chicken Curry"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="author">
              Author or source
            </label>
            <input
              id="author"
              className={styles.input}
              value={draft.author ?? ''}
              onChange={(event) => patch({ author: event.target.value || undefined })}
              placeholder="@chef"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sourceUrl">
              TikTok URL
            </label>
            <input
              id="sourceUrl"
              className={styles.input}
              type="url"
              value={draft.sourceUrl}
              onChange={(event) => patch({ sourceUrl: event.target.value })}
              placeholder="https://www.tiktok.com/..."
            />
          </div>

          <div className={`${styles.field} ${styles.span2}`}>
            <label className={styles.label} htmlFor="thumbnailUrl">
              Cover image URL
            </label>
            <input
              id="thumbnailUrl"
              className={styles.input}
              type="url"
              value={draft.thumbnailUrl ?? ''}
              onChange={(event) => patch({ thumbnailUrl: event.target.value || undefined })}
              placeholder="https://..."
            />
            <p className={styles.hint}>
              Linked, never copied. If it stops loading the recipe falls back to a placeholder.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="servings">
              Servings
            </label>
            <input
              id="servings"
              className={styles.input}
              type="number"
              min={1}
              max={48}
              value={draft.servings}
              onChange={(event) =>
                patch({ servings: Math.max(1, Number(event.target.value) || 1) })
              }
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="totalTime">
              Total time (minutes)
            </label>
            <input
              id="totalTime"
              className={styles.input}
              type="number"
              min={0}
              value={draft.totalTime ?? ''}
              onChange={(event) => patch({ totalTime: toOptionalNumber(event.target.value) })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="calories">
              Calories per serving
            </label>
            <input
              id="calories"
              className={styles.input}
              type="number"
              min={0}
              value={draft.calories ?? ''}
              onChange={(event) => patch({ calories: toOptionalNumber(event.target.value) })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="difficulty">
              Difficulty
            </label>
            <select
              id="difficulty"
              className={styles.select}
              value={draft.difficulty ?? ''}
              onChange={(event) =>
                patch({ difficulty: (event.target.value || undefined) as Difficulty | undefined })
              }
            >
              <option value="">Not set</option>
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label} id="rating-label">
              Rating
            </span>
            <div className={styles.ratingRow} role="group" aria-labelledby="rating-label">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.star} ${
                    (draft.rating ?? 0) >= value ? styles.starOn : ''
                  }`}
                  aria-pressed={(draft.rating ?? 0) >= value}
                  aria-label={`Rate ${value} out of 5`}
                  onClick={() => patch({ rating: draft.rating === value ? undefined : value })}
                >
                  <StarIcon size={20} />
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.field} ${styles.fullRow}`}>
            <span className={styles.label} id="meal-label">
              Meal
            </span>
            <div className={styles.mealRow} role="group" aria-labelledby="meal-label">
              {MEAL_TYPES.map(({ value, label }) => {
                const selected = (draft.mealTypes ?? []).includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.mealChip} ${selected ? styles.mealChipOn : ''}`}
                    aria-pressed={selected}
                    onClick={() =>
                      patch({
                        mealTypes: selected
                          ? (draft.mealTypes ?? []).filter((meal) => meal !== value)
                          : [...(draft.mealTypes ?? []), value],
                      })
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Ingredients</h2>
        <datalist id="unit-options">
          {ALL_UNITS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>
        <datalist id="group-options">
          {groupNames.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
        <p className={styles.hint}>
          Group is optional: rows sharing one ("Sauce", "Dough") are listed under that heading.
        </p>

        <ul className={styles.rows}>
          {draft.ingredients.map((ingredient, index) => (
            <li key={ingredient.id} className={styles.row}>
              <div className={styles.field}>
                <label className="sr-only" htmlFor={`qty-${ingredient.id}`}>
                  Quantity for ingredient {index + 1}
                </label>
                <input
                  id={`qty-${ingredient.id}`}
                  className={styles.input}
                  value={ingredient.displayQuantity ?? ''}
                  placeholder="1 1/2"
                  onChange={(event) =>
                    patchIngredient(ingredient.id, {
                      displayQuantity: event.target.value || undefined,
                      quantity: toQuantity(event.target.value),
                    })
                  }
                />
              </div>

              <div className={styles.field}>
                <label className="sr-only" htmlFor={`unit-${ingredient.id}`}>
                  Unit for ingredient {index + 1}
                </label>
                <input
                  id={`unit-${ingredient.id}`}
                  className={styles.input}
                  list="unit-options"
                  value={ingredient.unit ?? ''}
                  placeholder="cup"
                  onChange={(event) =>
                    patchIngredient(ingredient.id, { unit: event.target.value || undefined })
                  }
                />
              </div>

              <div className={styles.field}>
                <label className="sr-only" htmlFor={`name-${ingredient.id}`}>
                  Name for ingredient {index + 1}
                </label>
                <input
                  id={`name-${ingredient.id}`}
                  className={styles.input}
                  value={ingredient.name}
                  placeholder="flour"
                  onChange={(event) =>
                    patchIngredient(ingredient.id, { name: event.target.value })
                  }
                />
              </div>

              <div className={styles.field}>
                <label className="sr-only" htmlFor={`prep-${ingredient.id}`}>
                  Preparation for ingredient {index + 1}
                </label>
                <input
                  id={`prep-${ingredient.id}`}
                  className={styles.input}
                  value={ingredient.preparation ?? ''}
                  placeholder="minced"
                  onChange={(event) =>
                    patchIngredient(ingredient.id, {
                      preparation: event.target.value || undefined,
                    })
                  }
                />
              </div>

              <div className={`${styles.field} ${styles.groupField}`}>
                <label className="sr-only" htmlFor={`group-${ingredient.id}`}>
                  Group for ingredient {index + 1}
                </label>
                <input
                  id={`group-${ingredient.id}`}
                  className={styles.input}
                  list="group-options"
                  value={ingredient.group ?? ''}
                  placeholder="Group"
                  onChange={(event) =>
                    patchIngredient(ingredient.id, { group: event.target.value || undefined })
                  }
                />
              </div>

              <div className={styles.rowTools}>
                <button
                  type="button"
                  className={styles.iconButton}
                  disabled={index === 0}
                  aria-label={`Move ${ingredient.name || `ingredient ${index + 1}`} up`}
                  onClick={() =>
                    patch({ ingredients: moveItem(draft.ingredients, index, index - 1) })
                  }
                >
                  <ArrowUpIcon size={17} />
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  disabled={index === draft.ingredients.length - 1}
                  aria-label={`Move ${ingredient.name || `ingredient ${index + 1}`} down`}
                  onClick={() =>
                    patch({ ingredients: moveItem(draft.ingredients, index, index + 1) })
                  }
                >
                  <ArrowDownIcon size={17} />
                </button>
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.removeButton}`}
                  aria-label={`Remove ${ingredient.name || `ingredient ${index + 1}`}`}
                  onClick={() =>
                    patch({
                      ingredients: draft.ingredients.filter((item) => item.id !== ingredient.id),
                    })
                  }
                >
                  <TrashIcon size={17} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className={styles.addButton}
          onClick={() => patch({ ingredients: [...draft.ingredients, emptyIngredient()] })}
        >
          <PlusIcon size={17} />
          Add ingredient
        </button>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Directions</h2>
        <datalist id="section-options">
          {sectionNames.map((section) => (
            <option key={section} value={section} />
          ))}
        </datalist>
        <ol className={styles.rows}>
          {draft.directions.map((direction, index) => (
            <li key={direction.id} className={styles.stepRow}>
              <div className={styles.stepHead}>
                <span className={styles.stepBadge} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.label}>Step {index + 1}</span>
                <div className={styles.rowTools}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={index === 0}
                    aria-label={`Move step ${index + 1} up`}
                    onClick={() =>
                      patch({ directions: renumber(moveItem(draft.directions, index, index - 1)) })
                    }
                  >
                    <ArrowUpIcon size={17} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={index === draft.directions.length - 1}
                    aria-label={`Move step ${index + 1} down`}
                    onClick={() =>
                      patch({ directions: renumber(moveItem(draft.directions, index, index + 1)) })
                    }
                  >
                    <ArrowDownIcon size={17} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.removeButton}`}
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() =>
                      patch({
                        directions: renumber(
                          draft.directions.filter((item) => item.id !== direction.id),
                        ),
                      })
                    }
                  >
                    <TrashIcon size={17} />
                  </button>
                </div>
              </div>

              <label className="sr-only" htmlFor={`step-${direction.id}`}>
                Text for step {index + 1}
              </label>
              <textarea
                id={`step-${direction.id}`}
                className={styles.textarea}
                value={direction.text}
                onChange={(event) => patchDirection(direction.id, { text: event.target.value })}
                placeholder="Heat the olive oil in a skillet..."
              />

              <div className={styles.stepExtras}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`section-${direction.id}`}>
                    Section
                  </label>
                  <input
                    id={`section-${direction.id}`}
                    className={styles.input}
                    list="section-options"
                    value={direction.section ?? ''}
                    placeholder="Optional"
                    onChange={(event) =>
                      patchDirection(direction.id, { section: event.target.value || undefined })
                    }
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`timer-${direction.id}`}>
                    Timer (minutes)
                  </label>
                  <input
                    id={`timer-${direction.id}`}
                    className={styles.input}
                    type="number"
                    min={0}
                    step={0.5}
                    value={
                      direction.timerSeconds ? Math.round(direction.timerSeconds / 6) / 10 : ''
                    }
                    onChange={(event) => {
                      const minutes = toOptionalNumber(event.target.value)
                      patchDirection(direction.id, {
                        timerSeconds: minutes ? Math.round(minutes * 60) : undefined,
                      })
                    }}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`temp-${direction.id}`}>
                    Temperature
                  </label>
                  <input
                    id={`temp-${direction.id}`}
                    className={styles.input}
                    type="number"
                    value={direction.temperature?.value ?? ''}
                    onChange={(event) => {
                      const value = toOptionalNumber(event.target.value)
                      patchDirection(direction.id, {
                        temperature: value
                          ? { value, unit: direction.temperature?.unit ?? 'F' }
                          : undefined,
                      })
                    }}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`temp-unit-${direction.id}`}>
                    Scale
                  </label>
                  <select
                    id={`temp-unit-${direction.id}`}
                    className={styles.select}
                    value={direction.temperature?.unit ?? 'F'}
                    disabled={!direction.temperature}
                    onChange={(event) =>
                      patchDirection(direction.id, {
                        temperature: direction.temperature
                          ? {
                              ...direction.temperature,
                              unit: event.target.value as 'F' | 'C',
                            }
                          : undefined,
                      })
                    }
                  >
                    <option value="F">Fahrenheit</option>
                    <option value="C">Celsius</option>
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className={styles.addButton}
          onClick={() =>
            patch({
              directions: [...draft.directions, emptyDirection(draft.directions.length + 1)],
            })
          }
        >
          <PlusIcon size={17} />
          Add step
        </button>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Notes</h2>
        <div className={styles.field}>
          <label className="sr-only" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            className={styles.textarea}
            value={draft.notes ?? ''}
            onChange={(event) => patch({ notes: event.target.value || undefined })}
            placeholder="Swaps, tips, what you'd do differently next time."
          />
        </div>
      </section>

      <div className={styles.footer}>
        <button type="submit" className={styles.save}>
          Save Recipe
        </button>
        <Link className={styles.cancel} to={cancelHref}>
          Cancel
        </Link>

        {savedAt ? (
          <p className={styles.savedNote} role="status">
            Saved to this device
          </p>
        ) : null}

        <span className={styles.spacer} />

        {onDelete ? (
          confirmingDelete ? (
            <>
              <button
                type="button"
                className={styles.cancel}
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </button>
              <button
                type="button"
                className={`${styles.save} ${styles.dangerSave}`}
                onClick={onDelete}
              >
                Delete for good
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.cancel}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete recipe
            </button>
          )
        ) : null}
      </div>
    </form>
  )
}
