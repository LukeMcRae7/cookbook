/**
 * schema.org/Recipe — the structured data nearly every recipe site embeds as
 * JSON-LD, because Google requires it for recipe rich results. Reading it is
 * exact where parsing page prose is a guess, so it is always tried first.
 *
 * Everything here is pure (no DOM), so it runs and is tested in Node.
 */

import type { Direction, Ingredient, ParsedRecipe, ParseWarning } from '../../types/recipe'
import { createDirection, renumberDirections } from '../parser/directionParser'
import { dedupeIngredients, nextIngredientId, parseIngredientPhrase } from '../parser/ingredientParser'
import { splitRunOnDirections } from '../parser/reflow'
import { classifyMealTypes } from '../../lib/mealTypes'
import { siteLabel } from './detect'
import type { ImportResult } from './types'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asArray = (value: Json | undefined): Json[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°',
  frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔', frac18: '⅛',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', times: '×', eacute: 'é', egrave: 'è', ntilde: 'ñ', uuml: 'ü',
}

/** Decodes HTML entities and strips tags — JSON-LD strings often carry both. */
export function cleanText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z0-9]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function text(value: Json | undefined): string | undefined {
  if (typeof value === 'string') return cleanText(value) || undefined
  if (typeof value === 'number') return String(value)
  return undefined
}

/** Pulls every <script type="application/ld+json"> payload out of raw HTML. */
export function extractJsonLd(html: string): Json[] {
  const blocks: Json[] = []
  const pattern = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(pattern)) {
    const raw = match[1]
      .replace(/^\s*<!--/, '')
      .replace(/-->\s*$/, '')
      .replace(/^\s*\/\/\s*<!\[CDATA\[/, '')
      .replace(/\/\/\s*\]\]>\s*$/, '')
      .trim()
    if (!raw) continue
    try {
      blocks.push(JSON.parse(raw) as Json)
    } catch {
      // A malformed block elsewhere on the page must not stop the search.
    }
  }
  return blocks
}

function hasType(node: JsonObject, type: string): boolean {
  return asArray(node['@type']).some(
    (value) => typeof value === 'string' && value.replace(/^.*[/:]/, '').toLowerCase() === type,
  )
}

/**
 * Yoast and similar plugins write the author as {"@id": "…#/schema/person/1"}
 * and put the Person elsewhere in the graph. Index every identified node so
 * those references can be followed.
 */
export function indexById(blocks: Json[]): Map<string, JsonObject> {
  const index = new Map<string, JsonObject>()
  const visit = (value: Json | undefined, depth: number): void => {
    if (depth > 10 || value === undefined || value === null || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1))
      return
    }
    const id = value['@id']
    if (typeof id === 'string' && Object.keys(value).length > 1 && !index.has(id)) index.set(id, value)
    Object.values(value).forEach((item) => visit(item, depth + 1))
  }
  blocks.forEach((block) => visit(block, 0))
  return index
}

function resolveRefs(value: Json | undefined, index?: Map<string, JsonObject>): Json | undefined {
  if (!index || value === undefined) return value
  const resolveOne = (item: Json): Json => {
    if (isObject(item) && typeof item['@id'] === 'string' && Object.keys(item).length === 1) {
      return index.get(item['@id']) ?? item
    }
    return item
  }
  return Array.isArray(value) ? value.map(resolveOne) : resolveOne(value)
}

/** Depth-first search through arrays, @graph and mainEntity for a Recipe. */
export function findRecipeNode(data: Json | undefined, depth = 0): JsonObject | undefined {
  if (depth > 8 || data === undefined || data === null) return undefined
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1)
      if (found) return found
    }
    return undefined
  }
  if (!isObject(data)) return undefined
  if (hasType(data, 'recipe')) return data
  return (
    findRecipeNode(data['@graph'], depth + 1) ??
    findRecipeNode(data.mainEntity, depth + 1) ??
    findRecipeNode(data.mainEntityOfPage, depth + 1) ??
    findRecipeNode(data.itemListElement, depth + 1)
  )
}

/** ISO 8601 duration ("PT1H30M", "P0DT0H45M") -> minutes. */
export function parseIsoDuration(value: Json | undefined): number | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
    value.trim(),
  )
  if (!match) return undefined
  const [, days, hours, minutes, seconds] = match.map((part) => (part ? Number(part) : 0))
  const total = days * 1440 + hours * 60 + minutes + seconds / 60
  return total > 0 ? Math.round(total) : undefined
}

/** recipeYield comes as 4, "4", "4 servings", "Serves 4-6", ["4", "4 servings"]. */
export function parseYield(value: Json | undefined): number | undefined {
  for (const item of asArray(value)) {
    const raw = typeof item === 'number' ? String(item) : typeof item === 'string' ? item : ''
    const match = /(\d+)/.exec(raw)
    if (match) {
      const servings = Number(match[1])
      if (servings >= 1 && servings <= 100) return servings
    }
  }
  return undefined
}

function firstName(value: Json | undefined): string | undefined {
  for (const item of asArray(value)) {
    if (typeof item === 'string') return cleanText(item) || undefined
    if (isObject(item)) {
      const name = text(item.name)
      if (name) return name
    }
  }
  return undefined
}

function firstImage(value: Json | undefined, pageUrl: string): string | undefined {
  for (const item of asArray(value)) {
    const url = typeof item === 'string' ? item : isObject(item) ? text(item.url) ?? text(item.contentUrl) : undefined
    if (url) {
      try {
        return new URL(url, pageUrl).toString()
      } catch {
        return url
      }
    }
  }
  return undefined
}

/**
 * recipeInstructions is the least consistent field on the web: a string, an
 * array of strings, HowToStep objects, HowToSections of steps, or an ItemList.
 */
export function flattenInstructions(value: Json | undefined): string[] {
  return instructionSteps(value).map((step) => step.text)
}

export interface InstructionStep {
  text: string
  /** The HowToSection it came from ("Curry Sauce"), if any. */
  section?: string
}

/** Like flattenInstructions, keeping each step's HowToSection name. */
export function instructionSteps(value: Json | undefined): InstructionStep[] {
  const steps: InstructionStep[] = []

  const visit = (item: Json | undefined, section?: string): void => {
    if (item === undefined || item === null) return
    if (typeof item === 'string') {
      const cleaned = cleanText(item)
      const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean)
      const texts = lines.length === 1 && lines[0].length > 400 ? splitRunOnDirections(lines[0]) : lines
      texts.forEach((text) => steps.push({ text, section }))
      return
    }
    if (Array.isArray(item)) {
      item.forEach((child) => visit(child, section))
      return
    }
    if (!isObject(item)) return
    if (item.itemListElement !== undefined) {
      // A HowToSection's name labels every step inside it.
      const name = hasType(item, 'howtosection') ? text(item.name)?.replace(/:$/, '') : undefined
      visit(item.itemListElement, name ?? section)
      return
    }
    const body = text(item.text) ?? text(item.name) ?? text(item.description)
    if (body) steps.push({ text: body, section })
  }

  visit(value)
  return steps
    .map((step) => ({ ...step, text: step.text.replace(/^\d{1,2}[.)]\s+/, '').trim() }))
    .filter((step) => step.text)
}

function toIngredient(line: string): Ingredient {
  const cleaned = cleanText(line).replace(/\n+/g, ' ')
  // A site's list is authoritative: anything the parser cannot structure is
  // kept verbatim as the name rather than dropped.
  return (
    parseIngredientPhrase(cleaned, { strict: false }) ?? {
      id: nextIngredientId(),
      name: cleaned.toLowerCase(),
      checked: false,
    }
  )
}

function nutritionCalories(value: Json | undefined): number | undefined {
  if (!isObject(value)) return undefined
  const raw = text(value.calories)
  const match = raw ? /(\d+(?:\.\d+)?)/.exec(raw) : null
  return match ? Math.round(Number(match[1])) : undefined
}

function ratingValue(value: Json | undefined): number | undefined {
  if (!isObject(value)) return undefined
  const rating = Number(text(value.ratingValue))
  const best = Number(text(value.bestRating) ?? 5) || 5
  if (!Number.isFinite(rating) || rating <= 0) return undefined
  return Math.min(5, Math.max(1, Math.round((rating / best) * 5)))
}

function keywordList(value: Json | undefined): string[] {
  return asArray(value)
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => cleanText(item))
    .filter(Boolean)
}

export interface SchemaFallbacks {
  title?: string
  image?: string
  siteName?: string
}

/** Maps a schema.org Recipe node to the app's import shape. */
export function recipeFromSchema(
  node: JsonObject,
  pageUrl: string,
  fallbacks: SchemaFallbacks = {},
  index?: Map<string, JsonObject>,
  /** Which group an ingredient line belongs to, when the page shows groups. */
  groupOf?: (line: string) => string | undefined,
): ImportResult {
  const ingredients = dedupeIngredients(
    asArray(node.recipeIngredient ?? node.ingredients)
      .flatMap((item) => (typeof item === 'string' ? cleanText(item).split('\n') : []))
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const ingredient = toIngredient(line)
        const group = groupOf?.(line)
        return group ? { ...ingredient, group } : ingredient
      }),
  )

  const directions: Direction[] = renumberDirections(
    instructionSteps(node.recipeInstructions).map((step, index) => {
      const direction = createDirection(step.text, index + 1)
      return step.section ? { ...direction, section: step.section } : direction
    }),
  )

  const prepTime = parseIsoDuration(node.prepTime)
  const cookTime = parseIsoDuration(node.cookTime)
  const totalTime =
    parseIsoDuration(node.totalTime) ?? (prepTime || cookTime ? (prepTime ?? 0) + (cookTime ?? 0) : undefined)

  const warnings: ParseWarning[] = []
  if (ingredients.length === 0) warnings.push('no-ingredients')
  if (directions.length === 0) warnings.push('no-directions')
  if (ingredients.length === 0 && directions.length === 0) warnings.push('no-recipe-content')

  // "Marry Me Chicken Pasta {One Pot Recipe}" — braces and brackets on a
  // recipe title are SEO tags; parentheses can be meaningful and stay.
  const title =
    text(node.name)?.replace(/\s*[{[][^}\]]*[}\]]\s*$/, '').trim() || fallbacks.title
  const parsed: ParsedRecipe = {
    title,
    servings: parseYield(node.recipeYield),
    totalTime,
    calories: nutritionCalories(node.nutrition),
    ingredients,
    directions,
    warnings,
    confidence: ingredients.length && directions.length ? 1 : 0.5,
  }

  return {
    origin: 'web',
    sourceUrl: pageUrl,
    sourceLabel: fallbacks.siteName ?? siteLabel(pageUrl),
    title,
    author: firstName(resolveRefs(node.author, index)),
    thumbnailUrl: firstImage(resolveRefs(node.image, index), pageUrl) ?? fallbacks.image,
    parsed,
    prepTime,
    cookTime,
    rating: ratingValue(node.aggregateRating),
    mealTypes: classifyMealTypes({
      title,
      categories: [...keywordList(node.recipeCategory), ...keywordList(node.recipeCuisine)],
      tags: keywordList(node.keywords),
      ingredients,
    }),
    notices: [],
  }
}

/** A Recipe node from anywhere in a page's JSON-LD, with an index for its references. */
export function findRecipeInHtml(
  html: string,
): { node: JsonObject; index: Map<string, JsonObject> } | undefined {
  const blocks = extractJsonLd(html)
  for (const block of blocks) {
    const node = findRecipeNode(block)
    if (node) return { node, index: indexById(blocks) }
  }
  return undefined
}

export type { Json, JsonObject }
