import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface CookTimer {
  id: string
  label: string
  recipeId?: string
  directionId?: string
  totalSeconds: number
  /** Seconds left when paused, or at the moment `endsAt` was set. */
  remainingSeconds: number
  running: boolean
  /** Epoch ms the timer will hit zero. Only meaningful while running. */
  endsAt?: number
  finishedAt?: number
}

interface TimerStoreValue {
  timers: CookTimer[]
  startTimer(input: {
    label: string
    seconds: number
    recipeId?: string
    directionId?: string
  }): string
  pauseTimer(id: string): void
  resumeTimer(id: string): void
  resetTimer(id: string): void
  dismissTimer(id: string): void
  timerForDirection(directionId: string): CookTimer | undefined
}

const TimerStoreContext = createContext<TimerStoreValue | null>(null)
const STORAGE_KEY = 'cookbook.timers.v1'

function loadTimers(): CookTimer[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CookTimer[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistTimers(timers: CookTimer[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timers))
  } catch {
    // Timers are a convenience; losing them on a storage failure is fine.
  }
}

/** Recomputes the countdown from wall-clock time so tab throttling can't drift. */
function tick(timer: CookTimer, now: number): CookTimer {
  if (!timer.running || timer.endsAt === undefined) return timer
  const remaining = Math.max(0, Math.round((timer.endsAt - now) / 1000))
  // The interval runs at 2Hz but the display only changes once a second, so
  // return the same object when nothing moved and skip the re-render.
  if (remaining === timer.remainingSeconds && remaining > 0) return timer
  if (remaining === 0) {
    return {
      ...timer,
      remainingSeconds: 0,
      running: false,
      endsAt: undefined,
      finishedAt: timer.finishedAt ?? now,
    }
  }
  return { ...timer, remainingSeconds: remaining }
}

export function TimerStoreProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<CookTimer[]>(() =>
    loadTimers().map((timer) => tick(timer, Date.now())),
  )

  const hasRunningTimer = timers.some((timer) => timer.running)

  useEffect(() => {
    if (!hasRunningTimer) return
    const interval = window.setInterval(() => {
      const now = Date.now()
      setTimers((current) => {
        const next = current.map((timer) => tick(timer, now))
        return next.some((timer, index) => timer !== current[index]) ? next : current
      })
    }, 500)
    return () => window.clearInterval(interval)
  }, [hasRunningTimer])

  // Persist on structural changes only. A running timer is fully described by
  // `endsAt`, so there is no reason to write to disk once a second.
  const timersRef = useRef(timers)
  timersRef.current = timers
  const persistKey = timers
    .map((timer) => `${timer.id}:${timer.running}:${timer.endsAt ?? timer.remainingSeconds}`)
    .join('|')

  useEffect(() => {
    persistTimers(timersRef.current)
  }, [persistKey])

  const startTimer = useCallback<TimerStoreValue['startTimer']>(
    ({ label, seconds, recipeId, directionId }) => {
      const id = `timer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const timer: CookTimer = {
        id,
        label,
        recipeId,
        directionId,
        totalSeconds: seconds,
        remainingSeconds: seconds,
        running: true,
        endsAt: Date.now() + seconds * 1000,
      }
      setTimers((current) => [
        // One timer per step: restarting a step replaces its old timer.
        ...current.filter((item) => !directionId || item.directionId !== directionId),
        timer,
      ])
      return id
    },
    [],
  )

  const pauseTimer = useCallback((id: string) => {
    setTimers((current) =>
      current.map((timer) => {
        if (timer.id !== id || !timer.running) return timer
        const remaining = timer.endsAt
          ? Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000))
          : timer.remainingSeconds
        return { ...timer, running: false, endsAt: undefined, remainingSeconds: remaining }
      }),
    )
  }, [])

  const resumeTimer = useCallback((id: string) => {
    setTimers((current) =>
      current.map((timer) => {
        if (timer.id !== id || timer.running || timer.remainingSeconds <= 0) return timer
        return {
          ...timer,
          running: true,
          finishedAt: undefined,
          endsAt: Date.now() + timer.remainingSeconds * 1000,
        }
      }),
    )
  }, [])

  const resetTimer = useCallback((id: string) => {
    setTimers((current) =>
      current.map((timer) =>
        timer.id === id
          ? {
              ...timer,
              running: false,
              endsAt: undefined,
              finishedAt: undefined,
              remainingSeconds: timer.totalSeconds,
            }
          : timer,
      ),
    )
  }, [])

  const dismissTimer = useCallback((id: string) => {
    setTimers((current) => current.filter((timer) => timer.id !== id))
  }, [])

  const timerForDirection = useCallback(
    (directionId: string) => timers.find((timer) => timer.directionId === directionId),
    [timers],
  )

  const value = useMemo<TimerStoreValue>(
    () => ({
      timers,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      dismissTimer,
      timerForDirection,
    }),
    [timers, startTimer, pauseTimer, resumeTimer, resetTimer, dismissTimer, timerForDirection],
  )

  return <TimerStoreContext.Provider value={value}>{children}</TimerStoreContext.Provider>
}

export function useTimers(): TimerStoreValue {
  const context = useContext(TimerStoreContext)
  if (!context) throw new Error('useTimers must be used inside a TimerStoreProvider')
  return context
}
