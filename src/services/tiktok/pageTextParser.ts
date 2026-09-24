import { extractServings, parseRecipe } from '../parser/recipeParser'
import type { ParsedRecipe } from '../../types/recipe'

/**
 * Reads text copied off a TikTok video page.
 *
 * A page paste can contain up to three things: the creator handle, the caption
 * (which increasingly holds the full written recipe), and TikTok's AI-generated
 * summary. The summary is only worth parsing when the caption is not already a
 * complete recipe — otherwise it just duplicates it.
 */

export type RecipeSource = 'caption' | 'summary' | 'none'

export interface TikTokPageText {
  authorHandle?: string
  title?: string
  caption: string
  summary?: string
  hasSummary: boolean
  /** The region that produced the recipe below. */
  source: RecipeSource
  /** True when a summary was present but skipped as a duplicate. */
  summaryIgnored: boolean
  /** The creator points at a recipe hosted somewhere else. */
  mentionsExternalRecipe: boolean
  recipe: ParsedRecipe
}

/**
 * Copying from a rendered page often loses every newline, gluing words to the
 * next heading ("...flakesInstructionsSeason"). These rules put the breaks back
 * at boundaries that cannot occur inside ordinary prose.
 */
export function normalizePageText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    // lowercase or bracket immediately followed by a capital
    .replace(/([a-z)\]])([A-Z])/g, '$1\n$2')
    // an emoji sitting between the caption and the next heading
    .replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])[ \t]*([A-Z])/gu, '$1\n$2')
    // sentence end glued straight onto the next sentence
    .replace(/([.!?])([A-Z])/g, '$1\n$2')
    // a colon glued to the next capitalised word ("chicken:Coat") — but not
    // "chicken: Coat", which is a step label followed by its own sentence
    .replace(/([:;])([A-Z])/g, '$1\n$2')
    // a colon introducing a section heading ("Chicken Pasta: Ingredients")
    .replace(/([:;])[ \t]+(?=(?:Ingredients?|Instructions?|Directions?|Method|Steps|Notes?)\b)/g, '$1\n')
    // a numbered step glued onto the previous sentence
    .replace(/([.!?])[ \t]*(\d+[.)]\s)/g, '$1\n$2')
    // a quantity glued onto the previous word ("powder1 tsp", "Chicken2 breasts")
    .replace(/([a-z)\]])(\d)/g, '$1\n$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/** "dadsfoodtoday · 7-8" or "@aflavorfulbite" */
const HANDLE_LINE = /^@?([a-z0-9._]{2,30})\s*(?:[·•|]\s*\d{1,2}[-/]\d{1,2}.*)?$/i

export function extractHandle(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 3)) {
    const match = HANDLE_LINE.exec(line.trim())
    // Require a separator or an @ so ordinary one-word lines are not handles.
    if (match && (/[·•|@]/.test(line) || line.startsWith('@'))) {
      return `@${match[1].replace(/^@/, '')}`
    }
  }
  return undefined
}

/** Lines that only ever appear inside TikTok's generated summary. */
const SUMMARY_MARKERS =
  /^(?:lead|summary|overview|why\s+this\s+works|closing(?:\s*\/?\s*call\s+to\s+action)?|call\s+to\s+action|keywords?\s*:|step[-\s]?by[-\s]?step\s+instructions|quick\s+notes|tips\s+and\s+variations|this\s+(?:dish|recipe)\s+(?:highlights|features))/i

function findSummaryStart(lines: string[]): number {
  return lines.findIndex((line) => SUMMARY_MARKERS.test(line.trim()))
}

const SENTENCE_END = /[.!?,]$/
const SECTION_WORD =
  /^(?:ingredients?|instructions?|directions?|steps?|method|notes?|tips?|lead|keywords?)\b/i

/** A short, Title Case, punctuation-free line reads as a dish name. */
function looksLikeTitle(line: string): boolean {
  const trimmed = line.replace(/:$/, '').trim()
  if (!trimmed || trimmed.length > 64) return false
  const words = trimmed.split(/\s+/)
  if (words.length > 10 || words.length < 2) return false
  if (SENTENCE_END.test(trimmed)) return false
  if (SECTION_WORD.test(trimmed)) return false
  if (/^\d/.test(trimmed)) return false
  const capitalised = words.filter((word) => /^[A-Z0-9]/.test(word)).length
  return capitalised / words.length >= 0.6
}

export function extractPageTitle(lines: string[]): string | undefined {
  for (const line of lines) {
    if (HANDLE_LINE.test(line) && /[·•|@]/.test(line)) continue
    if (looksLikeTitle(line)) return line.replace(/:$/, '').trim()
  }
  return undefined
}

const EXTERNAL_RECIPE =
  /\b(?:link\s+in\s+(?:my\s+)?bio|full\s+recipe\s+(?:is\s+)?(?:on|at)\s+my\s+(?:website|blog|site)|recipe\s+on\s+my\s+(?:website|blog|site)|see\s+my\s+website)\b/i

/** A recipe you could actually cook from: it has both halves. */
function isComplete(parsed: ParsedRecipe): boolean {
  return parsed.ingredients.length > 0 && parsed.directions.length > 0
}

function score(parsed: ParsedRecipe): number {
  const quantified = parsed.ingredients.filter((i) => i.quantity !== undefined).length
  return parsed.ingredients.length + parsed.directions.length * 2 + quantified
}

export function readTikTokPageText(raw: string): TikTokPageText {
  const normalized = normalizePageText(raw ?? '')
  const lines = normalized.split('\n').filter(Boolean)

  const authorHandle = extractHandle(lines)
  const summaryStart = findSummaryStart(lines)
  const hasSummary = summaryStart !== -1

  const captionLines = hasSummary ? lines.slice(0, summaryStart) : lines
  const summaryLines = hasSummary ? lines.slice(summaryStart) : []

  const caption = captionLines.join('\n')
  const summary = hasSummary ? summaryLines.join('\n') : undefined

  const fromCaption = parseRecipe(caption)

  // The caption already holds a complete recipe, so the summary would only
  // restate it — parse the caption and leave the summary alone.
  if (isComplete(fromCaption)) {
    return {
      authorHandle,
      title: extractPageTitle(lines),
      caption,
      summary,
      hasSummary,
      source: 'caption',
      summaryIgnored: hasSummary,
      mentionsExternalRecipe: EXTERNAL_RECIPE.test(normalized),
      // Servings and tips are the two things a summary states that a caption
      // usually omits. They are facts, not duplicated steps, so fill the gaps
      // from the wider text rather than discarding them with the summary.
      recipe: {
        ...fromCaption,
        servings: fromCaption.servings ?? extractServings(normalized),
        notes: fromCaption.notes ?? (summary ? parseRecipe(summary).notes : undefined),
      },
    }
  }

  const fromSummary = summary ? parseRecipe(summary) : undefined
  const useSummary =
    fromSummary !== undefined && score(fromSummary) > score(fromCaption)
  const chosen = useSummary ? (fromSummary as ParsedRecipe) : fromCaption

  return {
    authorHandle,
    title: extractPageTitle(lines),
    caption,
    summary,
    hasSummary,
    source: score(chosen) > 0 ? (useSummary ? 'summary' : 'caption') : 'none',
    summaryIgnored: false,
    mentionsExternalRecipe: EXTERNAL_RECIPE.test(normalized),
    recipe: chosen,
  }
}

/** True when the paste carries the structure of a TikTok page rather than plain captions. */
export function looksLikePageText(raw: string): boolean {
  const normalized = normalizePageText(raw ?? '')
  const lines = normalized.split('\n').filter(Boolean)
  return findSummaryStart(lines) !== -1 || extractHandle(lines) !== undefined
}
