// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readableText, recipeFromHtml } from './htmlRecipe'
import { buildBookmarklet, decodeBookmarkletPayload, recipeFromBookmarklet } from './bookmarklet'

afterEach(() => {
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const MICRODATA_PAGE = `<html><head><meta property="og:site_name" content="Old Blog"></head><body>
<div itemscope itemtype="http://schema.org/Recipe">
  <h1 itemprop="name">Classic Banana Bread</h1>
  <span itemprop="author">Jo</span>
  <meta itemprop="totalTime" content="PT1H10M">
  <span itemprop="recipeYield">1 loaf (10 slices)</span>
  <ul>
    <li itemprop="recipeIngredient">3 ripe bananas, mashed</li>
    <li itemprop="recipeIngredient">1/3 cup melted butter</li>
    <li itemprop="recipeIngredient">1 1/2 cups flour</li>
  </ul>
  <div itemprop="recipeInstructions">Preheat the oven to 350.</div>
  <div itemprop="recipeInstructions">Mix everything and bake for 1 hour.</div>
</div></body></html>`

const PLAIN_PAGE = `<html><head><title>Grandma's Scones</title>
<meta property="og:image" content="https://blog.test/scones.jpg"></head><body>
<nav>Home Recipes About</nav>
<article>
  <h1>Grandma's Scones</h1>
  <p>These are the scones my grandma made every Sunday.</p>
  <h2>Ingredients</h2>
  <ul><li>2 cups self-raising flour</li><li>50 g cold butter</li><li>3/4 cup milk</li></ul>
  <h2>Method</h2>
  <ol><li>Rub the butter into the flour.</li><li>Stir in the milk to form a dough.</li><li>Bake at 220°C for 12 minutes.</li></ol>
</article>
<footer>© Grandma's Kitchen</footer></body></html>`

describe('recipe pages without JSON-LD', () => {
  it('reads schema.org microdata', () => {
    const result = recipeFromHtml(MICRODATA_PAGE, 'https://oldblog.test/banana-bread')
    expect(result).toMatchObject({ title: 'Classic Banana Bread', author: 'Jo', sourceLabel: 'Old Blog' })
    expect(result.parsed).toMatchObject({ servings: 1, totalTime: 70 })
    expect(result.parsed.ingredients.map((i) => i.name)).toEqual(['ripe bananas', 'butter', 'flour'])
    expect(result.parsed.directions[0].temperature).toEqual({ value: 350, unit: 'F' })
    expect(result.parsed.directions[1].timerSeconds).toBe(3600)
    expect(result.text).toBeUndefined()
  })

  it('falls back to the page’s readable text, skipping navigation and footers', () => {
    const doc = new DOMParser().parseFromString(PLAIN_PAGE, 'text/html')
    const text = readableText(doc)
    expect(text).not.toContain('Home Recipes About')
    expect(text).not.toContain('©')

    const result = recipeFromHtml(PLAIN_PAGE, 'https://blog.test/scones')
    expect(result).toMatchObject({ title: "Grandma's Scones", thumbnailUrl: 'https://blog.test/scones.jpg' })
    expect(result.parsed.ingredients.map((i) => i.name)).toEqual(['self-raising flour', 'cold butter', 'milk'])
    expect(result.parsed.directions).toHaveLength(3)
    expect(result.parsed.directions[2].temperature).toEqual({ value: 220, unit: 'C' })
    expect(result.notices[0].message).toMatch(/plain text/)
  })
})

describe('Save to cookbook bookmark', () => {
  /** Runs the generated bookmarklet in this document and returns the URL it opens. */
  function runBookmarklet(appUrl: string): string {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const code = buildBookmarklet(appUrl)
    expect(code.startsWith('javascript:')).toBe(true)
    new Function(decodeURIComponent(code.slice('javascript:'.length)))()
    expect(open).toHaveBeenCalledOnce()
    return open.mock.calls[0][0] as string
  }

  function payloadFrom(url: string) {
    const data = new URL(url.replace('#/', '')).searchParams.get('data')
    return decodeBookmarkletPayload(data ?? '')
  }

  it('sends the page’s Recipe node, with references resolved, to the app', () => {
    document.head.innerHTML = `
      <meta property="og:image" content="https://site.test/og.jpg">
      <script type="application/ld+json">{"@graph":[
        {"@type":"Person","@id":"#jo","name":"Jo Cook"},
        {"@type":["Recipe"],"name":"Lemon Bars","author":{"@id":"#jo"},
         "recipeIngredient":["1 cup flour","2 lemons, juiced"],
         "recipeInstructions":[{"@type":"HowToStep","text":"Bake for 20 minutes."}]}]}</script>`

    const opened = runBookmarklet('https://me.github.io/cookbook/#/settings')
    expect(opened.startsWith('https://me.github.io/cookbook/#/import?data=')).toBe(true)

    const payload = payloadFrom(opened)
    expect(payload?.i).toBe('https://site.test/og.jpg')
    const result = recipeFromBookmarklet(payload!)
    expect(result).toMatchObject({ title: 'Lemon Bars', author: 'Jo Cook' })
    expect(result.parsed.ingredients).toHaveLength(2)
    expect(result.parsed.directions[0].timerSeconds).toBe(1200)
  })

  it('falls back to the page text when there is no structured data', () => {
    document.body.innerHTML = '<main>Ingredients\n2 cups rice\nMethod\nBoil the rice for 15 minutes.</main>'
    // jsdom has no layout engine, so innerText is missing; stand in with textContent.
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get(this: HTMLElement) {
        return this.textContent ?? ''
      },
    })

    const payload = payloadFrom(runBookmarklet('https://me.github.io/cookbook/'))
    expect(payload?.r).toBeNull()
    expect(payload?.x).toContain('2 cups rice')
    expect(recipeFromBookmarklet(payload!).parsed.ingredients[0]).toMatchObject({ quantity: 2, name: 'rice' })
  })

  it('stays a reasonable size for a bookmark', () => {
    expect(buildBookmarklet('https://me.github.io/cookbook/').length).toBeLessThan(2500)
  })
})
