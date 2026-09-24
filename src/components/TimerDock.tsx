import { ClockIcon, CloseIcon, PauseIcon, PlayIcon, ResetIcon } from './Icon'
import { useTimers } from '../state/TimerStore'
import { formatClock } from '../lib/recipe'
import styles from './TimerDock.module.css'

/**
 * Lives in the shell, so a timer started on a recipe keeps running while the
 * cook moves around the app.
 */
export function TimerDock() {
  const { timers, pauseTimer, resumeTimer, resetTimer, dismissTimer } = useTimers()

  if (timers.length === 0) return null

  return (
    <div className={styles.dock} aria-label="Active timers" role="region">
      {timers.map((timer) => {
        const finished = timer.remainingSeconds <= 0
        const progress = timer.totalSeconds
          ? ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100
          : 0

        return (
          <article
            key={timer.id}
            className={`${styles.timer} ${finished ? styles.done : ''}`}
          >
            <div
              className={styles.ring}
              style={{ ['--progress' as string]: progress }}
              aria-hidden="true"
            >
              <span className={styles.ringIcon}>
                <ClockIcon size={18} />
              </span>
            </div>

            <div className={styles.body}>
              <p className={styles.label}>{timer.label}</p>
              {finished ? (
                <p className={styles.doneLabel}>Time&apos;s up</p>
              ) : (
                <p className={styles.clock} aria-live="off">
                  {formatClock(timer.remainingSeconds)}
                </p>
              )}
              <span className="sr-only" role="status">
                {finished
                  ? `${timer.label} timer finished`
                  : `${timer.label}, ${formatClock(timer.remainingSeconds)} remaining`}
              </span>
            </div>

            <div className={styles.controls}>
              {!finished ? (
                <button
                  type="button"
                  className={`${styles.control} ${styles.primary}`}
                  onClick={() => (timer.running ? pauseTimer(timer.id) : resumeTimer(timer.id))}
                  aria-label={
                    timer.running ? `Pause ${timer.label} timer` : `Resume ${timer.label} timer`
                  }
                >
                  {timer.running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                </button>
              ) : null}

              <button
                type="button"
                className={styles.control}
                onClick={() => resetTimer(timer.id)}
                aria-label={`Reset ${timer.label} timer`}
              >
                <ResetIcon size={18} />
              </button>

              <button
                type="button"
                className={styles.control}
                onClick={() => dismissTimer(timer.id)}
                aria-label={`Dismiss ${timer.label} timer`}
              >
                <CloseIcon size={18} />
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
