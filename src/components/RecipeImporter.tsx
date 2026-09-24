import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertIcon, ImageIcon, LinkIcon, SparkIcon, TextIcon } from './Icon'
import { useRecipeStore } from '../state/RecipeStore'
import { MEAL_TYPE_LABEL } from '../lib/mealTypes'
import {
  ImportError,
  importFromInput,
  importScreenshot,
  importText,
  recipeFromImport,
  reparseImport,
  type ImportResult,
} from '../services/import'
import styles from './RecipeImporter.module.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; label: string; progress?: number }
  | { kind: 'error'; message: string; blocked?: boolean }

/** Long or multi-line paste into the link box is recipe text, not a link. */
function looksLikePastedText(value: string): boolean {
  return value.includes('\n') || (value.length > 300 && !/^\s*https?:\/\/\S+\s*$/.test(value))
}

export function RecipeImporter({ initialResult }: { initialResult?: ImportResult }) {
  const navigate = useNavigate()
  const { saveRecipe, settings } = useRecipeStore()
  const imageInput = useRef<HTMLInputElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)

  const [link, setLink] = useState('')
  const [textMode, setTextMode] = useState(false)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [result, setResult] = useState<ImportResult | undefined>(initialResult)

  useEffect(() => {
    if (initialResult) setResult(initialResult)
  }, [initialResult])

  const options = {
    relay: settings.corsRelay || undefined,
    onProgress: (progress: number, label: string) =>
      setStatus({ kind: 'working', label, progress }),
  }

  async function run(work: () => Promise<ImportResult> | ImportResult, label: string) {
    setResult(undefined)
    setStatus({ kind: 'working', label })
    try {
      setResult(await work())
      setStatus({ kind: 'idle' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      setStatus({
        kind: 'error',
        message,
        blocked: error instanceof ImportError && error.kind === 'blocked',
      })
    }
  }

  function submitLink(event: React.FormEvent) {
    event.preventDefault()
    const value = link.trim()
    if (!value) {
      setStatus({ kind: 'error', message: 'Paste a TikTok or recipe link first.' })
      return
    }
    void run(() => importFromInput(value, options), 'Fetching')
  }

  function submitText() {
    if (!text.trim()) return
    void run(() => importText(text), 'Reading')
  }

  function pickImage(file: File | undefined) {
    if (!file) return
    setTextMode(false)
    void run(() => importScreenshot(file, options), 'Reading screenshot')
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'))
    if (image) {
      event.preventDefault()
      pickImage(image)
      return
    }
    const pasted = event.clipboardData.getData('text')
    if (looksLikePastedText(pasted)) {
      event.preventDefault()
      setText(pasted)
      setTextMode(true)
      requestAnimationFrame(() => textArea.current?.focus())
    }
  }

  function save() {
    if (!result) return
    const recipe = saveRecipe(recipeFromImport(result))
    const confident =
      result.parsed.confidence >= 0.8 &&
      result.parsed.ingredients.length > 0 &&
      result.parsed.directions.length > 0
    navigate(confident ? `/recipes/${recipe.id}` : `/recipes/${recipe.id}/edit`, {
      state: confident ? undefined : { justImported: true },
    })
  }

  function reset() {
    setResult(undefined)
    setStatus({ kind: 'idle' })
    setLink('')
    setText('')
  }

  const working = status.kind === 'working'

  return (
    <div className={styles.importer}>
      <form className={styles.bar} onSubmit={submitLink} noValidate>
        <div className={styles.field}>
          <span className={styles.fieldIcon} aria-hidden="true">
            <LinkIcon size={20} />
          </span>
          <label className="sr-only" htmlFor="import-link">
            TikTok or recipe link
          </label>
          <input
            id="import-link"
            className={styles.input}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a TikTok or recipe link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onPaste={handlePaste}
          />
        </div>
        <button type="submit" className={styles.primary} disabled={working}>
          <SparkIcon size={18} />
          Import
        </button>
      </form>

      <div className={styles.alternatives}>
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            pickImage(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <button
          type="button"
          className={styles.ghost}
          onClick={() => imageInput.current?.click()}
          disabled={working}
        >
          <ImageIcon size={17} />
          Screenshot
        </button>
        <button
          type="button"
          className={`${styles.ghost} ${textMode ? styles.ghostActive : ''}`}
          aria-expanded={textMode}
          onClick={() => {
            setTextMode((open) => !open)
            requestAnimationFrame(() => textArea.current?.focus())
          }}
        >
          <TextIcon size={17} />
          Paste text
        </button>
      </div>

      {textMode ? (
        <div className={styles.textPanel}>
          <label className="sr-only" htmlFor="import-text">
            Recipe text
          </label>
          <textarea
            id="import-text"
            ref={textArea}
            className={styles.textarea}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste a caption, a TikTok page, or any recipe text"
          />
          <div className={styles.textActions}>
            <button type="button" className={styles.primary} onClick={submitText} disabled={!text.trim() || working}>
              Read recipe
            </button>
          </div>
        </div>
      ) : null}

      {status.kind === 'working' ? (
        <div className={styles.status} role="status" aria-live="polite">
          <span>{status.label}…</span>
          {status.progress !== undefined ? (
            <div className={styles.track} aria-hidden="true">
              <div className={styles.fill} style={{ width: `${Math.round(status.progress * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {status.kind === 'error' ? (
        <div className={styles.error} role="alert">
          <p className={styles.errorRow}>
            <AlertIcon size={18} />
            {status.message}
          </p>
          {status.blocked ? (
            <div className={styles.errorActions}>
              <Link className={styles.errorAction} to="/settings#save-button">
                Set up the “Save to cookbook” button
              </Link>
              <button
                type="button"
                className={styles.errorAction}
                onClick={() => {
                  setTextMode(true)
                  setStatus({ kind: 'idle' })
                }}
              >
                Paste the recipe text
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <ImportPreview
          result={result}
          onChange={setResult}
          onSave={save}
          onDiscard={reset}
        />
      ) : null}
    </div>
  )
}

interface ImportPreviewProps {
  result: ImportResult
  onChange(result: ImportResult): void
  onSave(): void
  onDiscard(): void
}

function ImportPreview({ result, onChange, onSave, onDiscard }: ImportPreviewProps) {
  const { parsed } = result
  const [imageFailed, setImageFailed] = useState(false)
  const empty = parsed.ingredients.length === 0 && parsed.directions.length === 0

  const byline = [result.author, result.sourceLabel].filter(Boolean).join(' · ')

  return (
    <section className={styles.preview} aria-label="Imported recipe">
      <div className={styles.source}>
        {result.thumbnailUrl && !imageFailed ? (
          <img
            className={styles.thumb}
            src={result.thumbnailUrl}
            alt=""
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.thumbFallback} aria-hidden="true">
            <SparkIcon size={24} />
          </div>
        )}
        <div className={styles.sourceBody}>
          <h2 className={styles.sourceTitle}>{result.title || 'Untitled recipe'}</h2>
          {byline ? <p className={styles.sourceMeta}>{byline}</p> : null}
        </div>
      </div>

      <div className={styles.facts} aria-live="polite">
        <span className={`${styles.fact} ${parsed.ingredients.length ? '' : styles.factWarn}`}>
          {parsed.ingredients.length} ingredients
        </span>
        <span className={`${styles.fact} ${parsed.directions.length ? '' : styles.factWarn}`}>
          {parsed.directions.length} steps
        </span>
        {parsed.servings ? <span className={styles.fact}>Serves {parsed.servings}</span> : null}
        {result.mealTypes.map((meal) => (
          <span key={meal} className={styles.fact}>
            {MEAL_TYPE_LABEL[meal]}
          </span>
        ))}
      </div>

      {result.notices.map((notice) => (
        <p
          key={notice.message}
          className={`${styles.notice} ${notice.tone === 'warn' ? styles.noticeWarn : ''}`}
        >
          <span className={styles.noticeIcon} aria-hidden="true">
            <AlertIcon size={16} />
          </span>
          {notice.message}
        </p>
      ))}

      {result.text !== undefined ? (
        <details className={styles.details} open={empty}>
          <summary>{result.origin === 'screenshot' ? 'Recognised text' : 'Source text'}</summary>
          <label className="sr-only" htmlFor="import-source-text">
            Source text
          </label>
          <textarea
            id="import-source-text"
            className={styles.textarea}
            value={result.text}
            onChange={(event) => onChange(reparseImport(result, event.target.value))}
          />
        </details>
      ) : null}

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onSave}>
          {empty ? 'Save and fill in' : 'Save recipe'}
        </button>
        <button type="button" className={styles.secondary} onClick={onDiscard}>
          Discard
        </button>
      </div>
    </section>
  )
}
