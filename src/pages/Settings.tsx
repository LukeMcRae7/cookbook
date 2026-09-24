import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRecipeStore } from '../state/RecipeStore'
import { recipeStorage } from '../storage/recipeStorage'
import { buildBookmarklet, parseBackup } from '../services/import'
import styles from './Settings.module.css'

/** The app's own address, which the bookmark opens. Works at any Pages subpath. */
function appUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}

export function Settings() {
  const {
    recipes,
    settings,
    updateSettings,
    restoreDemoRecipes,
    importRecipes,
    deleteAllRecipes,
  } = useRecipeStore()
  const location = useLocation()
  const [confirmingWipe, setConfirmingWipe] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [relayDraft, setRelayDraft] = useState(settings.corsRelay)
  const bookmarkLink = useRef<HTMLAnchorElement>(null)
  const backupInput = useRef<HTMLInputElement>(null)

  const bookmarklet = useMemo(() => buildBookmarklet(appUrl()), [])
  const storageAvailable = recipeStorage.isAvailable()

  // React warns about javascript: URLs in JSX, so set the bookmark's href directly.
  useEffect(() => {
    bookmarkLink.current?.setAttribute('href', bookmarklet)
  }, [bookmarklet])

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [location.hash])

  useEffect(() => setRelayDraft(settings.corsRelay), [settings.corsRelay])

  const relayValid = !relayDraft.trim() || (/^https?:\/\//.test(relayDraft) && relayDraft.includes('{url}'))

  function exportRecipes() {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cookbook-recipes.json'
    link.click()
    URL.revokeObjectURL(url)
    setStatus(`Exported ${recipes.length} recipes.`)
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    try {
      const added = importRecipes(parseBackup(await file.text()))
      setStatus(`Imported ${added} ${added === 1 ? 'recipe' : 'recipes'}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That file could not be imported.')
    }
  }

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarklet)
      setStatus('Bookmark code copied.')
    } catch {
      setStatus('Copying was blocked — drag the button to your bookmarks instead.')
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Cooking</h2>

        <div className={styles.row}>
          <p className={styles.rowLabel}>Temperature</p>
          <div className={styles.segment} role="group" aria-label="Temperature scale">
            {(['F', 'C'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                className={`${styles.segmentButton} ${
                  settings.temperatureUnit === unit ? styles.segmentActive : ''
                }`}
                aria-pressed={settings.temperatureUnit === unit}
                onClick={() => updateSettings({ temperatureUnit: unit })}
              >
                °{unit}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <p className={styles.rowLabel}>Keep ingredients checked between visits</p>
          <button
            type="button"
            className={`${styles.switch} ${settings.rememberChecklist ? styles.switchOn : ''}`}
            role="switch"
            aria-checked={settings.rememberChecklist}
            aria-label="Keep ingredients checked between visits"
            onClick={() => updateSettings({ rememberChecklist: !settings.rememberChecklist })}
          >
            <span className={styles.knob} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className={styles.card} id="save-button" aria-labelledby="save-title">
        <h2 className={styles.cardTitle} id="save-title">
          Save from any recipe site
        </h2>
        <p className={styles.about}>
          Most recipe sites block other apps from reading their pages. This bookmark runs on the
          site itself and sends the recipe here — nothing goes through a server.
        </p>
        <div className={styles.row}>
          <a
            ref={bookmarkLink}
            className={styles.bookmarklet}
            onClick={(event) => {
              event.preventDefault()
              setStatus('Drag this button to your bookmarks bar, then click it on a recipe page.')
            }}
          >
            Save to cookbook
          </a>
          <button type="button" className={styles.button} onClick={copyBookmarklet}>
            Copy code
          </button>
        </div>
        <p className={styles.hint}>
          Desktop: drag the button to your bookmarks bar. iPhone/iPad: bookmark any page, then edit
          the bookmark and paste the copied code as its address.
        </p>

        <div className={styles.field}>
          <label className={styles.rowLabel} htmlFor="relay">
            CORS relay <span className={styles.optional}>optional</span>
          </label>
          <input
            id="relay"
            className={styles.input}
            value={relayDraft}
            placeholder="https://your-relay.example/?url={url}"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!relayValid}
            onChange={(event) => setRelayDraft(event.target.value)}
            onBlur={() => {
              if (relayValid) updateSettings({ corsRelay: relayDraft.trim() })
            }}
          />
          <p className={styles.hint}>
            {relayValid
              ? 'Lets pasted recipe links work on sites that block direct reads. Recipe URLs are sent to this relay, so only use one you trust.'
              : 'Must start with http(s):// and contain {url}.'}
          </p>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Your data</h2>
        <p className={styles.about}>
          {storageAvailable
            ? `${recipes.length} recipes, stored only in this browser.`
            : 'This browser is blocking storage, so recipes last only until you close the tab.'}
        </p>

        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={exportRecipes} disabled={recipes.length === 0}>
            Export
          </button>
          <input
            ref={backupInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              void importBackup(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <button type="button" className={styles.button} onClick={() => backupInput.current?.click()}>
            Import backup
          </button>
          <button type="button" className={styles.button} onClick={restoreDemoRecipes}>
            Restore demos
          </button>
          {confirmingWipe ? (
            <>
              <button
                type="button"
                className={`${styles.button} ${styles.danger}`}
                onClick={() => {
                  deleteAllRecipes()
                  setConfirmingWipe(false)
                  setStatus('All recipes deleted.')
                }}
              >
                Delete everything
              </button>
              <button type="button" className={styles.button} onClick={() => setConfirmingWipe(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`${styles.button} ${styles.danger}`}
              onClick={() => setConfirmingWipe(true)}
              disabled={recipes.length === 0}
            >
              Delete all
            </button>
          )}
        </div>
      </section>

      {status ? (
        <p className={styles.status} role="status">
          {status}
        </p>
      ) : null}
    </div>
  )
}
