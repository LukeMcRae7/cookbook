import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { BookIcon, PlusIcon, SettingsIcon } from './Icon'
import { TimerDock } from './TimerDock'
import { useRecipeStore } from '../state/RecipeStore'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Add', icon: PlusIcon, end: true },
  { to: '/recipes', label: 'Recipes', icon: BookIcon, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { storageError, dismissStorageError } = useRecipeStore()
  const location = useLocation()
  // The recipe viewer manages its own full-bleed card width.
  const isWide = /^\/recipes\/[^/]+$/.test(location.pathname)

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NavLink to="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              <BookIcon size={20} />
            </span>
            cookbook
          </NavLink>

          <nav className={styles.nav} aria-label="Primary">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {storageError ? (
        <div className={styles.storageBanner} role="status">
          <span>{storageError}</span>
          <button type="button" onClick={dismissStorageError}>
            Dismiss
          </button>
        </div>
      ) : null}

      <main id="main" className={`${styles.main} ${isWide ? styles.wide : ''}`}>
        {children}
      </main>

      <nav className={styles.bottomNav} aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive
                ? `${styles.bottomLink} ${styles.bottomLinkActive}`
                : styles.bottomLink
            }
          >
            <Icon size={21} />
            {label}
          </NavLink>
        ))}
      </nav>

      <TimerDock />
    </div>
  )
}
