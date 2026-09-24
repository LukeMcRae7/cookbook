/**
 * Making sense of OCR output from a phone screenshot. Pure text in, pure text
 * out — no OCR here — so every rule is unit-testable.
 */

export interface ScreenshotReading {
  /** A TikTok video link visible in the image (share sheet, browser bar). */
  tiktokUrl?: string
  /** The creator's @handle, if one is visible. */
  handle?: string
  /** The recognised text with app chrome removed: usually the caption. */
  caption: string
}

/** OCR spaces out or misreads punctuation inside links: "tiktok . com", "tiktok,com". */
function repairUrls(text: string): string {
  return text
    .replace(/\btik\s*tok\s*[.,·]\s*com\b/gi, 'tiktok.com')
    .replace(/\b(vm|vt|www|m)\s*[.,·]\s*tiktok\.com/gi, '$1.tiktok.com')
    .replace(/tiktok\.com\s*\/\s*/gi, 'tiktok.com/')
    .replace(/\s*\/\s*video\s*\/\s*/gi, '/video/')
}

const TIKTOK_LINK =
  /(?:https?:\/\/)?(?:(?:www|m)\.)?tiktok\.com\/@([\w.]{2,30})\/video\/(\d{15,21})|(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]{6,14})|(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]{6,14})/i

export function findTikTokLink(text: string): string | undefined {
  const match = TIKTOK_LINK.exec(repairUrls(text))
  if (!match) return undefined
  if (match[1] && match[2]) return `https://www.tiktok.com/@${match[1]}/video/${match[2]}`
  if (match[3]) return `https://vm.tiktok.com/${match[3]}/`
  if (match[4]) return `https://www.tiktok.com/t/${match[4]}/`
  return undefined
}

/**
 * Lines that are TikTok's interface, not the creator's words: tab names,
 * button labels, like/comment counters, the sound ticker, timestamps.
 */
const CHROME_LINE = new RegExp(
  [
    // Tab names, alone or run together on one line ("Following For You")
    String.raw`^(?:(?:following|for\s*you|friends|inbox|profile|home|discover|shop|live|explore|search|stem)\s*)+$`,
    String.raw`^(?:add\s+(?:a\s+)?comment|comments?|share|save|reply|send|repost|see\s+(?:translation|more|less)|more|less|follow|message)\b.{0,12}$`,
    String.raw`^(?:original\s+sound|♬|♪)`,
    String.raw`^[\d.,]+\s*[kmb]?$`,
    String.raw`^\d{1,2}:\d{2}(?:\s*[ap]m)?$`,
    String.raw`^\d+\s*(?:s|m|h|d|w|mo|y)\s*ago$`,
    String.raw`^\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?$`,
    String.raw`^(?:search\s*[·•]|q\s)`,
  ].join('|'),
  'i',
)

/** A line of mostly symbols is OCR noise from icons. */
function isIconNoise(line: string): boolean {
  const letters = (line.match(/[a-z0-9]/gi) ?? []).length
  return line.length > 0 && letters / line.length < 0.5
}

export function readScreenshotText(raw: string): ScreenshotReading {
  const repaired = repairUrls(raw)
  const tiktokUrl = findTikTokLink(repaired)

  const handleMatch = /(?:^|\s)@([a-z0-9._]{2,30})\b(?!\.com|\/video)/i.exec(repaired)
  const handle = handleMatch ? `@${handleMatch[1]}` : undefined

  const caption = repaired
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3)
    .filter((line) => !CHROME_LINE.test(line))
    .filter((line) => !isIconNoise(line))
    // The handle line and any link are metadata, not caption.
    .filter((line) => !(handle && line.replace(/[·•|].*$/, '').trim() === handle))
    .map((line) => line.replace(/(?:https?:\/\/)?\S*tiktok\.com\S*/gi, '').trim())
    .filter(Boolean)
    .join('\n')

  return { tiktokUrl, handle, caption }
}
