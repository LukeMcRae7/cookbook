import { CloseIcon, SearchIcon } from './Icon'
import styles from './SearchBar.module.css'

interface SearchBarProps {
  value: string
  onChange(value: string): void
  placeholder?: string
  label?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search recipes',
  label = 'Search recipes',
}: SearchBarProps) {
  return (
    <div className={styles.bar}>
      <span className={styles.icon} aria-hidden="true">
        <SearchIcon size={20} />
      </span>
      <label className="sr-only" htmlFor="recipe-search">
        {label}
      </label>
      <input
        id="recipe-search"
        type="search"
        className={styles.input}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <CloseIcon size={18} />
        </button>
      ) : null}
    </div>
  )
}
