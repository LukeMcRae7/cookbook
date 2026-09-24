import { useRef } from 'react'
import styles from './SegmentedTabs.module.css'

export interface TabOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface SegmentedTabsProps<T extends string> {
  options: TabOption<T>[]
  value: T
  onChange(value: T): void
  label: string
}

/** ARIA tablist with roving arrow-key focus, styled as the reference pill. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedTabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const focusTab = (index: number) => {
    const wrapped = (index + options.length) % options.length
    refs.current[wrapped]?.focus()
    onChange(options[wrapped].value)
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {options.map((option, index) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`tab-${option.value}`}
            aria-selected={isActive}
            aria-controls={`panel-${option.value}`}
            tabIndex={isActive ? 0 : -1}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                focusTab(index + 1)
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                focusTab(index - 1)
              }
            }}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={styles.count}>{option.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
