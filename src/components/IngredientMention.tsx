import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatIngredientAmount } from '../lib/recipe'
import { findIngredientMentions } from '../lib/mentions'
import type { Ingredient } from '../types/recipe'
import styles from './IngredientMention.module.css'

/** Mouse and trackpad users get the card on hover; touch users tap for it. */
function canHover(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : false
}

const GAP = 8
const EDGE = 12

interface MentionProps {
  text: string
  ingredients: Ingredient[]
}

/** An ingredient named in a step, with its line from the ingredients list on hover or tap. */
function Mention({ text, ingredients }: MentionProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const id = useId()

  const show = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }, [])
  const hide = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    setOpen(false)
  }, [])
  const hideSoon = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 120)
  }, [])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  // Place the card under the word, or above it when there is no room below,
  // kept inside the viewport on narrow phones.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const place = () => {
      const word = anchor.current?.getBoundingClientRect()
      const box = card.current?.getBoundingClientRect()
      if (!word || !box) return
      const below = word.bottom + GAP
      const top =
        below + box.height > window.innerHeight - EDGE && word.top - GAP - box.height > EDGE
          ? word.top - GAP - box.height
          : below
      const left = Math.min(
        Math.max(EDGE, word.left + word.width / 2 - box.width / 2),
        Math.max(EDGE, window.innerWidth - EDGE - box.width),
      )
      setPosition({ top, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Tapping anywhere else or pressing Escape puts it away.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hide()
        anchor.current?.focus()
      }
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!anchor.current?.contains(target) && !card.current?.contains(target)) hide()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, hide])

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`${styles.mention} ${open ? styles.active : ''}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => (open ? hide() : show())}
        onMouseEnter={() => canHover() && show()}
        onMouseLeave={() => canHover() && hideSoon()}
        onBlur={(event) => {
          if (!card.current?.contains(event.relatedTarget as Node | null)) hideSoon()
        }}
      >
        {text}
      </button>
      {open
        ? createPortal(
            <div
              ref={card}
              id={id}
              role="tooltip"
              className={styles.card}
              style={
                position
                  ? { top: position.top, left: position.left }
                  : { top: 0, left: 0, visibility: 'hidden' }
              }
              onMouseEnter={() => canHover() && show()}
              onMouseLeave={() => canHover() && hideSoon()}
            >
              {ingredients.map((ingredient) => {
                const amount = formatIngredientAmount(ingredient)
                return (
                  <div key={ingredient.id} className={styles.line}>
                    {ingredient.group ? <span className={styles.group}>{ingredient.group}</span> : null}
                    <span className={styles.amount}>{amount || 'To taste'}</span>
                    <span className={styles.name}>
                      {ingredient.name}
                      {ingredient.preparation ? (
                        <span className={styles.prep}>, {ingredient.preparation}</span>
                      ) : null}
                    </span>                  </div>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/** Step text with every ingredient it names made into a Mention. */
export function MentionText({ text, ingredients }: MentionProps): ReactNode {
  const mentions = ingredients.length ? findIngredientMentions(text, ingredients) : []
  if (mentions.length === 0) return text

  const parts: ReactNode[] = []
  let cursor = 0
  for (const mention of mentions) {
    if (mention.start > cursor) parts.push(text.slice(cursor, mention.start))
    parts.push(
      <Mention
        key={mention.start}
        text={text.slice(mention.start, mention.end)}
        ingredients={mention.ingredients}
      />,
    )
    cursor = mention.end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}
