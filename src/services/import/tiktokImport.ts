import { parseRecipe } from '../parser/recipeParser'
import { tikTokProvider } from '../tiktok/TikTokProvider'
import { titleFromCaption } from '../tiktok/caption'
import { classifyMealTypes, extractHashtags } from '../../lib/mealTypes'
import { ImportError, type ImportNotice, type ImportOptions, type ImportResult } from './types'

const EXTERNAL_RECIPE =
  /\b(?:link\s+in\s+(?:my\s+)?bio|full\s+recipe\s+(?:is\s+)?(?:on|at)\s+my\s+(?:website|blog|site)|recipe\s+on\s+my\s+(?:website|blog|site))\b/i

/** Builds an import from caption text — shared by link imports and screenshots. */
export function recipeFromCaption(
  caption: string,
  base: Pick<ImportResult, 'origin' | 'sourceUrl' | 'sourceLabel' | 'author' | 'thumbnailUrl'> & {
    title?: string
  },
): ImportResult {
  const parsed = parseRecipe(caption)
  const title = base.title ?? titleFromCaption(caption)
  const notices: ImportNotice[] = []

  const complete = parsed.ingredients.length > 0 && parsed.directions.length > 0
  if (!complete && EXTERNAL_RECIPE.test(caption)) {
    notices.push({
      tone: 'warn',
      message: "The caption doesn't include the full recipe — the creator keeps it on their website. Paste it below, or import that page's link.",
    })
  } else if (parsed.warnings.includes('no-recipe-content')) {
    notices.push({
      tone: 'warn',
      message: 'No ingredients or steps in the caption. Paste the recipe below, or add a screenshot of it.',
    })
  }

  return {
    ...base,
    title,
    parsed,
    mealTypes: classifyMealTypes({ title, tags: extractHashtags(caption), ingredients: parsed.ingredients }),
    text: caption,
    notices,
  }
}

/**
 * A TikTok link -> its caption via oEmbed -> a parsed recipe. TikTok serves
 * oEmbed with open CORS, so this works from a static page with no key.
 */
export async function importTikTok(url: string, options: ImportOptions = {}): Promise<ImportResult> {
  const normalized = tikTokProvider.normalizeUrl(url)
  if (!normalized) throw new ImportError('invalid-url', "That doesn't look like a TikTok video link.")

  const metadata = await tikTokProvider.getVideoMetadata(normalized, { relay: options.relay })
  if (!metadata.ok) {
    throw new ImportError(
      metadata.reason === 'network' ? 'network' : 'not-found',
      metadata.reason === 'network'
        ? "Couldn't reach TikTok. Check your connection and try again."
        : 'TikTok could not find that video. It may be private or deleted.',
    )
  }

  const { caption, title, authorName, thumbnailUrl } = metadata.data
  return recipeFromCaption(caption ?? '', {
    origin: 'tiktok',
    sourceUrl: normalized,
    sourceLabel: 'TikTok',
    title,
    author: authorName,
    thumbnailUrl,
  })
}
