import { Fragment } from 'react'
import { ClockIcon, PlusIcon, ThermometerIcon } from './Icon'
import { useTimers } from '../state/TimerStore'
import { formatClock, formatMinutes, formatTemperature } from '../lib/recipe'
import { FOOD_KEYWORDS } from '../services/parser/vocabulary'
import type { Direction, TemperatureUnit } from '../types/recipe'
import styles from './DirectionList.module.css'

/** Staples are rarely what a timer is *for*, so they never name one. */
const GENERIC_FOODS = new Set(['water', 'salt', 'oil', 'pepper', 'sugar', 'flour'])

/** "Add rice and a pinch of salt" -> "Rice timer", else "Step 2 timer". */
function timerLabel(direction: Direction): string {
  const words = direction.text.toLowerCase().split(/[^a-z]+/)
  const food = words.find(
    (word) => word.length > 3 && FOOD_KEYWORDS.has(word) && !GENERIC_FOODS.has(word),
  )
  if (!food) return `Step ${direction.step}`
  return `${food.charAt(0).toUpperCase()}${food.slice(1)}`
}

/** 45 -> "45s", 840 -> "14m" */
function formatDurationTag(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return formatMinutes(Math.round(seconds / 60))
}

interface DirectionStepProps {
  direction: Direction
  recipeId: string
  temperatureUnit: TemperatureUnit
}

export function DirectionStep({ direction, recipeId, temperatureUnit }: DirectionStepProps) {
  const { startTimer, timerForDirection, pauseTimer, resumeTimer, dismissTimer } = useTimers()
  const timer = timerForDirection(direction.id)
  const label = timerLabel(direction)
  const hasExtras = Boolean(direction.timerSeconds || direction.temperature)
  const finished = timer ? timer.remainingSeconds <= 0 : false

  return (
    <li
      className={`${styles.step} ${hasExtras ? styles.stepCard : ''} ${
        timer && !finished ? styles.stepActive : ''
      }`}
    >
      <div className={styles.heading}>
        <h3 className={styles.stepNumber}>Step {direction.step}</h3>
      </div>

      <p className={styles.text}>{direction.text}</p>

      {hasExtras ? (
        <div className={styles.tags}>
          {direction.temperature ? (
            <span className={`${styles.tag} ${styles.tempTag}`}>
              <ThermometerIcon size={15} />
              {formatTemperature(direction.temperature, temperatureUnit)}
            </span>
          ) : null}
          {direction.timerSeconds ? (
            <span className={`${styles.tag} ${styles.timeTag}`}>
              <ClockIcon size={15} />
              {formatDurationTag(direction.timerSeconds)}
            </span>
          ) : null}
        </div>
      ) : null}

      {direction.timerSeconds ? (
        <div className={styles.actions}>
          {timer ? (
            <>
              <p className={`${styles.runningTimer} ${finished ? styles.timerDone : ''}`}>
                <ClockIcon size={16} />
                {finished ? "Time's up" : formatClock(timer.remainingSeconds)}
              </p>
              {!finished ? (
                <button
                  type="button"
                  className={styles.ghostAction}
                  onClick={() => (timer.running ? pauseTimer(timer.id) : resumeTimer(timer.id))}
                >
                  {timer.running ? 'Pause' : 'Resume'}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.ghostAction}
                onClick={() => dismissTimer(timer.id)}
              >
                Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.startTimer}
              onClick={() =>
                startTimer({
                  label: `${label} timer`,
                  seconds: direction.timerSeconds as number,
                  recipeId,
                  directionId: direction.id,
                })
              }
            >
              <span className={styles.startIcon} aria-hidden="true">
                <PlusIcon size={20} />
              </span>
              Start {label} Timer
            </button>
          )}
        </div>
      ) : null}
    </li>
  )
}

interface DirectionListProps {
  directions: Direction[]
  recipeId: string
  temperatureUnit: TemperatureUnit
}

export function DirectionList({ directions, recipeId, temperatureUnit }: DirectionListProps) {
  return (
    <ol className={styles.list}>
      {directions.map((direction, index) => (
        <Fragment key={direction.id}>
          <DirectionStep
            direction={direction}
            recipeId={recipeId}
            temperatureUnit={temperatureUnit}
          />
          {index < directions.length - 1 ? (
            <li className={styles.divider} aria-hidden="true" />
          ) : null}
        </Fragment>
      ))}
    </ol>
  )
}
