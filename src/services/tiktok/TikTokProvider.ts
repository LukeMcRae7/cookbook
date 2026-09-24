import { titleFromCaption } from './caption'

/**
 * The app talks to this interface only, so the data source can change (oEmbed
 * today, a real API or a small backend later) without touching the UI.
 */

export interface TikTokVideoMetadata {
  /** Normalised canonical URL. */
  url: string
  videoId?: string
  title?: string
  /** The full video description, which is where creators write the recipe. */
  caption?: string
  authorName?: string
  authorUrl?: string
  thumbnailUrl?: string
}

export type ProviderFailureReason =
  | 'invalid-url'
  | 'unsupported-url'
  | 'network'
  | 'metadata-unavailable'
  | 'thumbnail-unavailable'
  | 'transcript-unavailable'

export interface ProviderFailure {
  ok: false
  reason: ProviderFailureReason
  message: string
}

export type ProviderResult<T> = { ok: true; data: T } | ProviderFailure

export interface ProviderOptions {
  /** CORS relay template containing "{url}", tried when a direct request fails. */
  relay?: string
}

export interface TikTokProvider {
  readonly name: string
  canHandle(url: string): boolean
  normalizeUrl(url: string): string | null
  getVideoMetadata(url: string, options?: ProviderOptions): Promise<ProviderResult<TikTokVideoMetadata>>
  getThumbnail(url: string): Promise<ProviderResult<string>>
  getTranscript(url: string): Promise<ProviderResult<string>>
}

const LONG_FORM = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.-]+)\/(?:video|photo)\/(\d+)/i
const SHORT_FORM = /^https?:\/\/(?:vm|vt)\.tiktok\.com\/([\w-]+)/i
const REDIRECT_FORM = /^https?:\/\/(?:www\.)?tiktok\.com\/t\/([\w-]+)/i
const EMBED_FORM = /^https?:\/\/(?:www\.)?tiktok\.com\/embed\/v\d\/(\d+)/i

function withProtocol(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^(www\.|m\.|vm\.|vt\.)?tiktok\.com/i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

export function isTikTokUrl(raw: string): boolean {
  const url = withProtocol(raw)
  return (
    LONG_FORM.test(url) ||
    SHORT_FORM.test(url) ||
    REDIRECT_FORM.test(url) ||
    EMBED_FORM.test(url)
  )
}

/** Drops tracking params and rebuilds the canonical form where possible. */
export function normalizeTikTokUrl(raw: string): string | null {
  const url = withProtocol(raw)
  if (!url) return null

  const long = LONG_FORM.exec(url)
  if (long) return `https://www.tiktok.com/@${long[1]}/video/${long[2]}`

  const embed = EMBED_FORM.exec(url)
  if (embed) return `https://www.tiktok.com/embed/v2/${embed[1]}`

  const short = SHORT_FORM.exec(url)
  if (short) {
    const host = /vt\./i.test(url) ? 'vt' : 'vm'
    return `https://${host}.tiktok.com/${short[1]}`
  }

  const redirect = REDIRECT_FORM.exec(url)
  if (redirect) return `https://www.tiktok.com/t/${redirect[1]}`

  return null
}

export function extractVideoId(url: string): string | undefined {
  return LONG_FORM.exec(url)?.[2] ?? EMBED_FORM.exec(url)?.[1]
}

interface OEmbedResponse {
  title?: string
  author_name?: string
  author_unique_id?: string
  author_url?: string
  thumbnail_url?: string
}

const OEMBED_ENDPOINT = 'https://www.tiktok.com/oembed'
const REQUEST_TIMEOUT_MS = 8000

async function fetchOEmbed(url: string, relay?: string): Promise<ProviderResult<OEmbedResponse>> {
  const direct = await requestOEmbed(`${OEMBED_ENDPOINT}?url=${encodeURIComponent(url)}`)
  if (direct.ok || direct.reason !== 'network' || !relay) return direct
  // TikTok serves oEmbed with open CORS today; the relay only matters if that changes.
  const viaRelay = relay.replace('{url}', encodeURIComponent(`${OEMBED_ENDPOINT}?url=${encodeURIComponent(url)}`))
  return requestOEmbed(viaRelay)
}

async function requestOEmbed(requestUrl: string): Promise<ProviderResult<OEmbedResponse>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(requestUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      return {
        ok: false,
        reason: 'metadata-unavailable',
        message:
          response.status === 404
            ? 'TikTok could not find that video. It may be private or deleted.'
            : `TikTok returned ${response.status} for this link.`,
      }
    }

    return { ok: true, data: (await response.json()) as OEmbedResponse }
  } catch {
    // Almost always a CORS rejection or an offline browser. Either way the
    // import can continue — the user just fills in the details themselves.
    return {
      ok: false,
      reason: 'network',
      message:
        'Your browser could not reach TikTok directly. This is normal for a site with no backend.',
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Uses TikTok's public oEmbed endpoint — the only TikTok surface a static page
 * can call without keys. It yields caption, author and cover image, but never
 * captions/transcript, which TikTok does not expose publicly.
 */
export class OEmbedTikTokProvider implements TikTokProvider {
  readonly name = 'tiktok-oembed'

  canHandle(url: string): boolean {
    return isTikTokUrl(url)
  }

  normalizeUrl(url: string): string | null {
    return normalizeTikTokUrl(url)
  }

  async getVideoMetadata(
    url: string,
    options: ProviderOptions = {},
  ): Promise<ProviderResult<TikTokVideoMetadata>> {
    const normalized = this.normalizeUrl(url)
    if (!normalized) {
      return {
        ok: false,
        reason: url.trim() ? 'unsupported-url' : 'invalid-url',
        message: 'That does not look like a TikTok video link.',
      }
    }

    const result = await fetchOEmbed(normalized, options.relay)
    if (!result.ok) {
      return {
        ...result,
        // Callers can still build a recipe around the bare URL.
        reason: result.reason === 'network' ? 'network' : 'metadata-unavailable',
      }
    }

    const { title, author_name, author_unique_id, author_url, thumbnail_url } = result.data
    const handle = author_unique_id ?? author_name
    return {
      ok: true,
      data: {
        url: normalized,
        videoId: extractVideoId(normalized),
        // No title beats a wrong one: a caption that names no dish ("Check the
        // 📌 in my bio") leaves the title for the cook to write.
        title: title ? titleFromCaption(title) : undefined,
        caption: title?.trim() || undefined,
        authorName: handle ? `@${handle.replace(/^@/, '')}` : undefined,
        authorUrl: author_url,
        thumbnailUrl: thumbnail_url,
      },
    }
  }

  async getThumbnail(url: string): Promise<ProviderResult<string>> {
    const metadata = await this.getVideoMetadata(url)
    if (!metadata.ok) return metadata
    if (!metadata.data.thumbnailUrl) {
      return {
        ok: false,
        reason: 'thumbnail-unavailable',
        message: 'TikTok did not return a cover image for this video.',
      }
    }
    return { ok: true, data: metadata.data.thumbnailUrl }
  }

  /**
   * TikTok publishes no transcript through any browser-reachable endpoint, and
   * a static site cannot proxy around that. We say so plainly instead of
   * pretending, and the UI falls back to pasting or uploading the captions.
   */
  async getTranscript(_url: string): Promise<ProviderResult<string>> {
    return {
      ok: false,
      reason: 'transcript-unavailable',
      message:
        'TikTok does not expose video captions to other websites, so the transcript has to be pasted in.',
    }
  }
}

export const tikTokProvider: TikTokProvider = new OEmbedTikTokProvider()
