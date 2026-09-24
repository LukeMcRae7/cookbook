/**
 * Getting a recipe out of a whole HTML page, strongest evidence first:
 *   1. schema.org JSON-LD   (exact — most sites)
 *   2. schema.org microdata (exact — older sites)
 *   3. the page's readable text through the rule-based parser (a best guess)
 * Uses the browser's DOMParser; tests run it under jsdom.
 */

import { parseRecipe } from '../parser/recipeParser'
import { canonicalUnit } from '../parser/units'
import { classifyMealTypes } from '../../lib/mealTypes'
import { siteLabel } from './detect'
import {
  cleanText,
  findRecipeInHtml,
  recipeFromSchema,
  type Json,
  type JsonObject,
  type SchemaFallbacks,
} from './schemaRecipe'
import type { ImportResult } from './types'

function meta(doc: Document, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const element = doc.querySelector(`meta[property="${key}"], meta[name="${key}"]`)
    const content = element?.getAttribute('content')?.trim()
    if (content) return cleanText(content)
  }
  return undefined
}

export function pageFallbacks(doc: Document): SchemaFallbacks {
  return {
    title: meta(doc, 'og:title', 'twitter:title') ?? (doc.title ? cleanText(doc.title) : undefined),
    image: meta(doc, 'og:image', 'twitter:image'),
    siteName: meta(doc, 'og:site_name'),
  }
}

/** Reads schema.org microdata (itemprop="recipeIngredient" …) into a JSON-LD-like node. */
export function recipeNodeFromMicrodata(root: ParentNode): JsonObject | undefined {
  const scope = root.querySelector('[itemtype*="schema.org/Recipe" i]')
  if (!scope) return undefined

  const values = (prop: string): string[] =>
    Array.from(scope.querySelectorAll(`[itemprop="${prop}"]`)).map((element) =>
      element.getAttribute('content') ??
      element.getAttribute('datetime') ??
      element.getAttribute('src') ??
      element.textContent ??
      '',
    )

  const first = (prop: string): string | undefined => values(prop).find((value) => value.trim())

  const node: JsonObject = { '@type': 'Recipe' }
  const assign = (key: string, value: Json | undefined) => {
    if (value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      node[key] = value
    }
  }
  assign('name', first('name'))
  assign('author', first('author'))
  assign('image', first('image'))
  assign('recipeYield', first('recipeYield'))
  assign('prepTime', first('prepTime'))
  assign('cookTime', first('cookTime'))
  assign('totalTime', first('totalTime'))
  assign('recipeCategory', first('recipeCategory'))
  assign('recipeIngredient', [...values('recipeIngredient'), ...values('ingredients')])
  assign('recipeInstructions', values('recipeInstructions'))
  return node
}

const MATCH_STOPWORDS = new Set(['see', 'note', 'notes', 'the', 'and', 'for', 'with', 'optional'])

/**
 * The words that identify an ingredient line, ignoring amounts, units and
 * conversions: "1 Tbsp (15 g) butter" and "1 Tbsp butter" both give {butter}.
 */
function ingredientWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !MATCH_STOPWORDS.has(word) && canonicalUnit(word) === null),
  )
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  a.forEach((word) => {
    if (b.has(word)) shared += 1
  })
  return shared / (a.size + b.size - shared)
}

/**
 * A heading above an ingredient list that names no group: the card's own
 * "Ingredients" title (with its "1x 2x 3x" scaling buttons), unit toggles.
 */
function groupFromHeading(text: string): string {
  const name = text.replace(/:$/, '').trim()
  const forGroup = /^ingredients?\s+for\s+(?:the\s+)?(.+)$/i.exec(name)
  if (forGroup) return forGroup[1].charAt(0).toUpperCase() + forGroup[1].slice(1)
  if (/^(?:ingredients?|equipment|instructions?|directions?|method|notes?|nutrition|us customary|metric)\b/i.test(name)) {
    return ''
  }
  return name
}

/**
 * Pairs of [ingredient line, group heading] as the page displays them. Recipe
 * plugins put each group's name in a heading just before its list:
 * WP Recipe Maker, Tasty Recipes, Mediavine Create and most hand-written posts.
 */
export function ingredientGroupsFromDom(root: ParentNode): [string, string][] {
  const container =
    root.querySelector(
      '.wprm-recipe-ingredients-container, .tasty-recipes-ingredients, .mv-create-ingredients, [class*="recipe-ingredients"]',
    ) ?? root.querySelector('[class*="ingredients"]')
  if (!container) return []

  const pairs: [string, string][] = []
  let heading = ''
  container
    .querySelectorAll('h2, h3, h4, h5, h6, [class*="group-name"], [class*="group-title"], li')
    .forEach((element) => {
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (element.tagName === 'LI') {
        if (heading) pairs.push([text, heading])
      } else {
        heading = groupFromHeading(text)
      }
    })
  return pairs
}

/**
 * Turns [line, group] pairs into a lookup for the structured ingredient lines.
 * Each displayed line is used once, so an ingredient listed in two groups
 * ("1 tsp garam masala" in the marinade and in the spices) lands in both.
 */
export function groupResolver(pairs: [string, string][]): ((line: string) => string | undefined) | undefined {
  const keyed = pairs.filter(([, group]) => group).map(([line, group]) => ({ words: ingredientWords(line), group, used: false }))
  if (keyed.length === 0) return undefined
  return (line: string) => {
    const words = ingredientWords(line)
    let best: (typeof keyed)[number] | undefined
    let bestScore = 0.49
    for (const candidate of keyed) {
      if (candidate.used) continue
      const score = overlap(words, candidate.words)
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    if (!best) return undefined
    best.used = true
    return best.group
  }
}

/** Containers recipe plugins wrap their cards in, then generic article bodies. */
const CONTENT_SELECTORS = [
  '.wprm-recipe-container',
  '.tasty-recipes',
  '.mv-create-card',
  '.recipe-card',
  '[class*="recipe-content"]',
  'article',
  'main',
]

/** The page's text with line structure kept, from its most recipe-like region. */
export function readableText(doc: Document): string {
  const region =
    CONTENT_SELECTORS.map((selector) => doc.querySelector(selector)).find(Boolean) ?? doc.body
  if (!region) return ''

  const clone = region.cloneNode(true) as Element
  clone
    .querySelectorAll('script, style, noscript, nav, header, footer, aside, form, iframe, svg, button')
    .forEach((element) => element.remove())

  // textContent loses line breaks; mark block boundaries before reading it.
  clone.querySelectorAll('br').forEach((element) => element.replaceWith('\n'))
  clone
    .querySelectorAll('p, li, div, h1, h2, h3, h4, h5, h6, tr, section')
    .forEach((element) => element.append('\n'))

  return (clone.textContent ?? '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function recipeFromText(text: string, pageUrl: string, fallbacks: SchemaFallbacks): ImportResult {
  const parsed = parseRecipe(text)
  const title = fallbacks.title ?? parsed.title
  return {
    origin: 'web',
    sourceUrl: pageUrl,
    sourceLabel: fallbacks.siteName ?? siteLabel(pageUrl),
    title,
    thumbnailUrl: fallbacks.image,
    parsed,
    mealTypes: classifyMealTypes({ title, ingredients: parsed.ingredients }),
    text,
    notices: [
      {
        tone: 'info',
        message: "This page has no structured recipe data, so it was read as plain text. Check it before saving.",
      },
    ],
  }
}

export function recipeFromHtml(html: string, pageUrl: string): ImportResult {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const fallbacks = pageFallbacks(doc)

  const groupOf = groupResolver(ingredientGroupsFromDom(doc))

  const fromJsonLd = findRecipeInHtml(html)
  if (fromJsonLd) return recipeFromSchema(fromJsonLd.node, pageUrl, fallbacks, fromJsonLd.index, groupOf)

  const fromMicrodata = recipeNodeFromMicrodata(doc)
  if (fromMicrodata) return recipeFromSchema(fromMicrodata, pageUrl, fallbacks, undefined, groupOf)

  return recipeFromText(readableText(doc), pageUrl, fallbacks)
}

/** For pasted text that turned out to be page source. */
export { recipeFromText }
