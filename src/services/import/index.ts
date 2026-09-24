/**
 * The import layer's front door. The UI hands over whatever the user gave it —
 * a link, pasted text, page source, JSON — and gets back one ImportResult.
 */

import type { Recipe } from '../../types/recipe'
import { createRecipeFromParsed } from '../../lib/recipe'
import { classifyMealTypes, extractHashtags } from '../../lib/mealTypes'
import { readTikTokPageText } from '../tiktok/pageTextParser'
import { classifyInput, findUrl, siteLabel } from './detect'
import { fetchPageHtml } from './fetchPage'
import { recipeFromHtml } from './htmlRecipe'
import { findRecipeNode, recipeFromSchema, type Json } from './schemaRecipe'
import { importTikTok } from './tiktokImport'
import { ImportError, type ImportOptions, type ImportResult } from './types'

export { importScreenshot } from './screenshotImport'
export { buildBookmarklet, decodeBookmarkletPayload, recipeFromBookmarklet } from './bookmarklet'
export { classifyInput, findUrl } from './detect'
export { parseBackup } from './backup'
export * from './types'

export async function importWebPage(url: string, options: ImportOptions = {}): Promise<ImportResult> {
  const html = await fetchPageHtml(url, options.relay)
  return recipeFromHtml(html, url)
}

/** Pasted text: plain captions, a TikTok page paste, page source, or JSON-LD. */
export function importText(value: string): ImportResult {
  const kind = classifyInput(value)

  if (kind === 'html') return recipeFromHtml(value, '')

  if (kind === 'json') {
    const node = findRecipeNode(JSON.parse(value) as Json)
    if (node) return recipeFromSchema(node, '', { siteName: 'Pasted recipe' })
  }

  return recipeFromPastedText(value)
}

function recipeFromPastedText(text: string): ImportResult {
  const page = readTikTokPageText(text)
  const title = page.title ?? page.recipe.title
  const notices: ImportResult['notices'] = []

  if (page.recipe.warnings.includes('no-recipe-content')) {
    notices.push({
      tone: 'warn',
      message: page.mentionsExternalRecipe
        ? 'No ingredients or steps here — the creator keeps the recipe on their website. Import that page instead.'
        : 'No ingredients or steps recognised yet. Paste text that lists quantities and instructions.',
    })
  }

  return {
    origin: 'text',
    sourceUrl: '',
    sourceLabel: 'Pasted text',
    title,
    author: page.authorHandle,
    parsed: page.recipe,
    mealTypes: classifyMealTypes({ title, tags: extractHashtags(text), ingredients: page.recipe.ingredients }),
    text,
    notices,
  }
}

/**
 * Anything the user typed or pasted into the import box. Links are fetched;
 * everything else is parsed locally.
 */
export async function importFromInput(value: string, options: ImportOptions = {}): Promise<ImportResult> {
  const kind = classifyInput(value)
  if (kind === 'empty') throw new ImportError('invalid-url', 'Paste a link or some recipe text first.')

  if (kind === 'tiktok-url') return importTikTok(findUrl(value) as string, options)
  if (kind === 'web-url') {
    const url = findUrl(value) as string
    try {
      return await importWebPage(url, options)
    } catch (error) {
      if (error instanceof ImportError) {
        throw new ImportError(error.kind, `${error.message} (${siteLabel(url)})`)
      }
      throw error
    }
  }
  return importText(value)
}

/**
 * Re-reads an import after the user corrected its source text. Keeps the
 * metadata that did not come from the text (link, image, author).
 */
export function reparseImport(result: ImportResult, text: string): ImportResult {
  const fresh = recipeFromPastedText(text)
  return {
    ...result,
    parsed: fresh.parsed,
    title: result.title ?? fresh.title,
    author: result.author ?? fresh.author,
    mealTypes: result.mealTypes.length ? result.mealTypes : fresh.mealTypes,
    text,
    notices: fresh.parsed.warnings.includes('no-recipe-content') ? fresh.notices : [],
  }
}

export function recipeFromImport(result: ImportResult): Recipe {
  const recipe = createRecipeFromParsed(result.parsed, {
    sourceUrl: result.sourceUrl,
    title: result.title,
    author: result.author,
    thumbnailUrl: result.thumbnailUrl,
  })
  return {
    ...recipe,
    prepTime: result.prepTime,
    cookTime: result.cookTime,
    calories: result.parsed.calories,
    rating: result.rating,
    mealTypes: result.mealTypes,
  }
}
