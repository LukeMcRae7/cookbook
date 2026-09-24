import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyInput, findUrl, siteLabel } from './detect'
import {
  cleanText,
  extractJsonLd,
  findRecipeInHtml,
  flattenInstructions,
  parseIsoDuration,
  parseYield,
  recipeFromSchema,
} from './schemaRecipe'
import { findTikTokLink, readScreenshotText } from './screenshotText'
import { parseBackup } from './backup'
import { importTikTok } from './tiktokImport'
import { importFromInput, importText, recipeFromImport } from './index'
import { ImportError } from './types'
import { PASTA_OEMBED_CAPTION } from '../tiktok/fixtures'

afterEach(() => vi.unstubAllGlobals())

describe('classifyInput', () => {
  it('recognises links, including inside a share message', () => {
    expect(classifyInput('https://www.tiktok.com/@chef/video/7300000000000000001')).toBe('tiktok-url')
    expect(classifyInput('Check out this video! https://vm.tiktok.com/ZMabc123/')).toBe('tiktok-url')
    expect(classifyInput('https://www.budgetbytes.com/one-pot-pasta/')).toBe('web-url')
    expect(classifyInput('budgetbytes.com/one-pot-pasta/')).toBe('web-url')
  })

  it('treats a long paste that merely contains a link as text', () => {
    const caption = `${'Ingredients 2 cups flour 1 tsp salt '.repeat(8)} full recipe https://example.com/x`
    expect(classifyInput(caption)).toBe('text')
  })

  it('recognises page source and JSON', () => {
    expect(classifyInput('<!DOCTYPE html><html></html>')).toBe('html')
    expect(classifyInput('{"@type":"Recipe"}')).toBe('json')
    expect(classifyInput('   ')).toBe('empty')
  })

  it('trims punctuation glued onto a link', () => {
    expect(findUrl('see (https://example.com/recipe).')).toBe('https://example.com/recipe')
    expect(siteLabel('https://www.budgetbytes.com/x')).toBe('budgetbytes.com')
  })
})

/** Shaped like a Yoast/WPRM page: a @graph with the author defined elsewhere. */
const JSON_LD_PAGE = `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"Person","@id":"https://site.test/#/person/1","name":"Beth Moncel"},
 {"@type":"WebPage","@id":"https://site.test/pasta/"},
 {"@type":"Recipe","name":"One Pot Cajun Pasta &amp; Chicken",
  "author":{"@id":"https://site.test/#/person/1"},
  "image":["https://site.test/pasta-1x1.jpg","https://site.test/pasta-4x3.jpg"],
  "recipeYield":["4","4 servings"],
  "prepTime":"PT10M","cookTime":"PT20M","totalTime":"PT30M",
  "recipeCategory":"Main Course","recipeCuisine":"Cajun","keywords":"weeknight dinner, one pot",
  "nutrition":{"@type":"NutritionInformation","calories":"483 kcal"},
  "aggregateRating":{"ratingValue":"4.8","ratingCount":"212"},
  "recipeIngredient":["1 lb. boneless, skinless chicken breast ($5.47)","1/2 lb. penne pasta","15 oz. can diced tomatoes","2 cups chicken broth","2 oz. cream cheese"],
  "recipeInstructions":[
   {"@type":"HowToSection","name":"Chicken","itemListElement":[
     {"@type":"HowToStep","text":"Season the chicken with the Cajun spices."},
     {"@type":"HowToStep","text":"Sear for 5 minutes until browned."}]},
   {"@type":"HowToSection","name":"Pasta","itemListElement":[
     {"@type":"HowToStep","text":"Add the pasta, tomatoes and broth. Simmer for 10 minutes."},
     {"@type":"HowToStep","text":"Stir in the cream cheese &#8211; serve."}]}
  ]}
]}</script>
<script type="application/ld+json">{ this is not valid json }</script>
</head><body></body></html>`

describe('schema.org recipes', () => {
  it('finds the Recipe inside a @graph and ignores broken blocks', () => {
    expect(extractJsonLd(JSON_LD_PAGE)).toHaveLength(1)
    expect(findRecipeInHtml(JSON_LD_PAGE)?.node.name).toBe('One Pot Cajun Pasta &amp; Chicken')
  })

  it('maps every field, following @id references', () => {
    const found = findRecipeInHtml(JSON_LD_PAGE)!
    const result = recipeFromSchema(found.node, 'https://site.test/pasta/', {}, found.index)

    expect(result).toMatchObject({
      origin: 'web',
      title: 'One Pot Cajun Pasta & Chicken',
      author: 'Beth Moncel',
      thumbnailUrl: 'https://site.test/pasta-1x1.jpg',
      prepTime: 10,
      cookTime: 20,
      rating: 5,
      sourceLabel: 'site.test',
    })
    expect(result.mealTypes).toContain('dinner')
    expect(result.parsed).toMatchObject({ servings: 4, totalTime: 30, calories: 483, warnings: [] })

    expect(result.parsed.ingredients[0]).toMatchObject({
      quantity: 1,
      unit: 'lb',
      name: 'boneless skinless chicken breast',
    })
    expect(result.parsed.ingredients[0].preparation).toBeUndefined()
    expect(result.parsed.ingredients).toHaveLength(5)

    expect(result.parsed.directions.map((d) => d.text)).toEqual([
      'Season the chicken with the Cajun spices.',
      'Sear for 5 minutes until browned.',
      'Add the pasta, tomatoes and broth. Simmer for 10 minutes.',
      'Stir in the cream cheese – serve.',
    ])
    expect(result.parsed.directions[1].timerSeconds).toBe(300)
  })

  it('turns an import into a complete saved recipe', () => {
    const found = findRecipeInHtml(JSON_LD_PAGE)!
    const recipe = recipeFromImport(recipeFromSchema(found.node, 'https://site.test/pasta/', {}, found.index))
    expect(recipe).toMatchObject({
      title: 'One Pot Cajun Pasta & Chicken',
      sourceUrl: 'https://site.test/pasta/',
      servings: 4,
      prepTime: 10,
      cookTime: 20,
      totalTime: 30,
      calories: 483,
      favorite: false,
    })
    expect(recipe.mealTypes).toContain('dinner')
  })

  it('reads every shape of recipeInstructions', () => {
    expect(flattenInstructions('Mix it.\nBake it.')).toEqual(['Mix it.', 'Bake it.'])
    expect(flattenInstructions(['1. Mix it.', '2. Bake it.'])).toEqual(['Mix it.', 'Bake it.'])
    expect(flattenInstructions('<ol><li>Mix it.</li><li>Bake it.</li></ol>')).toEqual(['Mix it.', 'Bake it.'])
    expect(flattenInstructions({ '@type': 'ItemList', itemListElement: [{ name: 'Mix it.' }] })).toEqual(['Mix it.'])
  })

  it('parses durations, yields and entities', () => {
    expect(parseIsoDuration('PT1H30M')).toBe(90)
    expect(parseIsoDuration('P0DT0H45M')).toBe(45)
    expect(parseIsoDuration('PT0S')).toBeUndefined()
    expect(parseYield('Serves 4-6')).toBe(4)
    expect(parseYield(12)).toBe(12)
    expect(cleanText('Salt &amp; pepper &frac12; tsp&nbsp;&#8211; to taste')).toBe('Salt & pepper ½ tsp – to taste')
  })

  it('accepts a pasted Recipe JSON object', () => {
    const result = importText(
      JSON.stringify({ '@type': 'Recipe', name: 'Toast', recipeIngredient: ['2 slices bread'], recipeInstructions: 'Toast the bread.' }),
    )
    expect(result).toMatchObject({ title: 'Toast' })
    expect(result.parsed.ingredients[0]).toMatchObject({ quantity: 2, unit: 'slice', name: 'bread' })
  })
})

describe('screenshot text', () => {
  it('finds a TikTok link even when OCR spaces out the punctuation', () => {
    expect(findTikTokLink('vm . tiktok . com/ZMh7AbCdE/')).toBe('https://vm.tiktok.com/ZMh7AbCdE/')
    expect(findTikTokLink('www.tiktok.com / @dadsfoodtoday / video / 7660288880272248078')).toBe(
      'https://www.tiktok.com/@dadsfoodtoday/video/7660288880272248078',
    )
    expect(findTikTokLink('no link here')).toBeUndefined()
  })

  it('keeps the caption and drops TikTok’s interface text', () => {
    const ocr = [
      'Following  For You',
      '12.3K',
      '481',
      'Share',
      '@dadsfoodtoday · 7-8',
      'One Pot Creamy Chicken Pasta',
      'Ingredients 2 chicken breasts 1 tbsp olive oil',
      '♬ original sound - dadsfoodtoday',
      'Add comment...',
      '© ® ™ ◎',
    ].join('\n')
    const reading = readScreenshotText(ocr)
    expect(reading.handle).toBe('@dadsfoodtoday')
    expect(reading.tiktokUrl).toBeUndefined()
    expect(reading.caption.split('\n')).toEqual([
      'One Pot Creamy Chicken Pasta',
      'Ingredients 2 chicken breasts 1 tbsp olive oil',
    ])
  })
})

describe('backups', () => {
  const recipe = { id: 'r-1', title: 'Soup', ingredients: [], directions: [], servings: 2 }

  it('reads the exported array or a { recipes } wrapper', () => {
    expect(parseBackup(JSON.stringify([recipe]))).toHaveLength(1)
    expect(parseBackup(JSON.stringify({ recipes: [recipe, { nope: true }] }))).toHaveLength(1)
  })

  it('rejects files that are not cookbook backups', () => {
    expect(() => parseBackup('not json')).toThrow(ImportError)
    expect(() => parseBackup('[{"hello":1}]')).toThrow(/doesn't contain any cookbook recipes/)
  })
})

function mockOEmbed(body: object, status = 200) {
  const fetchMock = vi.fn(async (_url: string) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('TikTok link import', () => {
  it('reads the recipe from the caption TikTok returns', async () => {
    const fetchMock = mockOEmbed({
      title: PASTA_OEMBED_CAPTION,
      author_name: 'dadsfoodtoday',
      author_unique_id: 'dadsfoodtoday',
      thumbnail_url: 'https://cdn.test/cover.jpg',
    })

    const result = await importTikTok('https://www.tiktok.com/@dadsfoodtoday/video/7660288880272248078?lang=en')

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      encodeURIComponent('https://www.tiktok.com/@dadsfoodtoday/video/7660288880272248078'),
    )
    expect(result).toMatchObject({
      origin: 'tiktok',
      title: 'One Pot Creamy Chicken Pasta',
      author: '@dadsfoodtoday',
      thumbnailUrl: 'https://cdn.test/cover.jpg',
      mealTypes: ['dinner'],
      notices: [],
    })
    expect(result.parsed.directions).toHaveLength(5)
    expect(result.text).toBe(PASTA_OEMBED_CAPTION.trim())
  })

  it('says so when the caption points elsewhere for the recipe', async () => {
    mockOEmbed({ title: 'honey chipotle chicken wrap 🍯 full recipe is on my website link in bio #chickenwrap', author_name: 'aflavorfulbite' })
    const result = await importTikTok('https://www.tiktok.com/@aflavorfulbite/video/7300000000000000002')
    expect(result.title).toBe('Honey Chipotle Chicken Wrap')
    expect(result.notices[0].message).toMatch(/keeps it on their website/)
  })

  it('reports a missing video', async () => {
    mockOEmbed({ message: 'not found' }, 404)
    await expect(importTikTok('https://www.tiktok.com/@x/video/7300000000000000003')).rejects.toMatchObject({
      kind: 'not-found',
    })
  })
})

describe('web link import', () => {
  it('reports a site that blocks cross-origin reads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(importFromInput('https://www.example-recipes.com/cake')).rejects.toMatchObject({
      kind: 'blocked',
      message: expect.stringContaining('example-recipes.com'),
    })
  })

  it('falls back to the configured relay', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('https://relay.test/')) return new Response(JSON_LD_PAGE, { status: 200 })
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)
    // DOMParser is needed for the HTML step; the JSON-LD path is covered in jsdom tests.
    vi.stubGlobal('DOMParser', class {
      parseFromString() {
        return { querySelector: () => null, title: '' }
      }
    })

    const result = await importFromInput('https://site.test/pasta/', { relay: 'https://relay.test/?url={url}' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toBe(`https://relay.test/?url=${encodeURIComponent('https://site.test/pasta/')}`)
    expect(result.title).toBe('One Pot Cajun Pasta & Chicken')
  })
})
