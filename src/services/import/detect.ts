import { isTikTokUrl } from '../tiktok/TikTokProvider'

export type InputKind = 'empty' | 'tiktok-url' | 'web-url' | 'html' | 'json' | 'text'

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/i
const BARE_DOMAIN_URL = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S*$/i

/** Trailing punctuation that share sheets and prose glue onto links. */
function trimUrl(url: string): string {
  return url.replace(/[)\].,;:!?'"]+$/, '')
}

/**
 * The first link in some text. Share sheets send "Check out this video! https://…",
 * so a link is still the point of an input when it arrives with a sentence.
 */
export function findUrl(text: string): string | undefined {
  const match = URL_IN_TEXT.exec(text)
  if (match) return trimUrl(match[0])
  const trimmed = text.trim()
  if (BARE_DOMAIN_URL.test(trimmed) && !/\s/.test(trimmed)) return `https://${trimUrl(trimmed)}`
  return undefined
}

/**
 * Decides what the user gave us. A link wins when the rest of the input is just
 * a short share message; a long paste that happens to contain a link is text.
 */
export function classifyInput(raw: string): InputKind {
  const value = raw.trim()
  if (!value) return 'empty'

  if (/^[[{]/.test(value)) {
    try {
      JSON.parse(value)
      return 'json'
    } catch {
      // Not JSON after all — fall through.
    }
  }
  if (/^<(?:!doctype|html|head|body|div|script|article|section)\b/i.test(value)) return 'html'

  const url = findUrl(value)
  if (url) {
    const remainder = value.replace(url, '').replace(/https?:\/\//, '').trim()
    if (remainder.length <= 160) return isTikTokUrl(url) ? 'tiktok-url' : 'web-url'
  }
  return 'text'
}

/** "https://www.budgetbytes.com/x" -> "budgetbytes.com" */
export function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Web page'
  }
}
