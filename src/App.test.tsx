// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { PASTA_OEMBED_CAPTION } from './services/tiktok/fixtures'

/**
 * Render tests, not a UI test suite: they prove the providers, router and every
 * page mount and the main flows work end to end, which a type-check cannot.
 */

let container: HTMLDivElement
let root: Root

/** Mount the app at a route. HashRouter reads the hash when it mounts, so
 *  setting it first is more reliable than firing hashchange afterwards. */
function renderAt(hash = '#/') {
  window.location.hash = hash
  act(() => {
    root.render(<App />)
  })
}

/** Re-mount at a different route; cheaper than a full router integration. */
function remount(hash: string) {
  act(() => root.unmount())
  root = createRoot(container)
  renderAt(hash)
}

function click(element: Element | null | undefined) {
  if (!element) throw new Error('Nothing to click')
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/** Clicks and lets the resulting promises (fetches, imports) settle. */
async function clickAndSettle(element: Element | null | undefined) {
  if (!element) throw new Error('Nothing to click')
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  act(() => {
    setValue?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function buttonWithText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.trim().startsWith(text),
  )
}

function textOf() {
  return container.textContent ?? ''
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = '#/'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the add screen', () => {
    renderAt()
    expect(textOf()).toContain('Add a recipe')
    expect(container.querySelector('#import-link')).not.toBeNull()
    expect(buttonWithText('Screenshot')).toBeDefined()
  })

  it('seeds the demo recipes into the library on a first visit', () => {
    renderAt('#/recipes')
    expect(textOf()).toContain('Chicken Curry')
    expect(textOf()).toContain('Garlic Butter Tomato Pasta')
  })

  it('filters the library by meal type', () => {
    renderAt('#/recipes')
    click(buttonWithText('Dessert'))
    expect(textOf()).toContain('Chocolate Chip Cookies')
    expect(textOf()).not.toContain('Chicken Curry')

    click(buttonWithText('All'))
    expect(textOf()).toContain('Chicken Curry')
  })

  it('renders a recipe with its ingredients and lets a step start a timer', () => {
    renderAt('#/recipes/demo-chicken-curry')

    expect(textOf()).toContain('Chicken Curry')
    expect(textOf()).toContain('basmati rice')
    expect(textOf()).toContain('425')

    const directionsTab = Array.from(container.querySelectorAll('[role="tab"]')).find((tab) =>
      tab.textContent?.includes('Directions'),
    )
    click(directionsTab)
    expect(textOf()).toContain('Step 1')

    click(buttonWithText('Start'))
    expect(container.querySelector('[aria-label="Active timers"]')).not.toBeNull()
  })

  it('scales ingredient quantities when servings change', () => {
    renderAt('#/recipes/demo-chicken-curry')
    expect(textOf()).toContain('1 cup')

    click(container.querySelector('[aria-label="Increase servings"]'))
    expect(textOf()).toContain('2 cups')
    expect(textOf()).toContain('Quantities scaled for 3 servings')
  })

  it('checks an ingredient off the list', () => {
    renderAt('#/recipes/demo-chicken-curry')
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox?.checked).toBe(false)
    click(checkbox)
    expect(textOf()).toContain('1 of 12 gathered')
  })

  it('renders the editor, the settings page and an unknown recipe', () => {
    renderAt('#/recipes/demo-chicken-curry/edit')
    expect(textOf()).toContain('Edit recipe')
    expect(container.querySelector<HTMLInputElement>('#title')?.value).toBe('Chicken Curry')
    expect(container.querySelector('[aria-labelledby="meal-label"]')?.textContent).toContain('Dinner')

    remount('#/settings')
    expect(textOf()).toContain('Save from any recipe site')
    expect(container.querySelector('#relay')).not.toBeNull()

    remount('#/recipes/does-not-exist')
    expect(textOf()).toContain('Recipe not found')
  })

  it('imports pasted text and saves it as a recipe', async () => {
    renderAt()
    click(buttonWithText('Paste text'))
    type(
      container.querySelector('#import-text') as HTMLTextAreaElement,
      'Ingredients\n2 cups flour\n1 tsp salt\n3 eggs\nInstructions\n1. Mix everything together.\n2. Bake at 350 degrees for 25 minutes.',
    )
    await clickAndSettle(buttonWithText('Read recipe'))

    expect(textOf()).toContain('3 ingredients')
    expect(textOf()).toContain('2 steps')

    await clickAndSettle(buttonWithText('Save'))
    expect(window.location.hash).toMatch(/#\/recipes\/r-/)
  })

  it('imports a TikTok link from its caption alone', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          title: PASTA_OEMBED_CAPTION,
          author_name: 'dadsfoodtoday',
          author_unique_id: 'dadsfoodtoday',
          thumbnail_url: 'https://example.com/cover.jpg',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderAt()
    type(
      container.querySelector('#import-link') as HTMLInputElement,
      'https://www.tiktok.com/@dadsfoodtoday/video/7660288880272248078',
    )
    await clickAndSettle(buttonWithText('Import'))

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(textOf()).toContain('One Pot Creamy Chicken Pasta')
    expect(textOf()).toContain('@dadsfoodtoday')
    expect(textOf()).toContain('5 steps')
    expect(textOf()).toContain('Dinner')
  })

  it('explains what to do when a recipe site blocks reading', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))

    renderAt()
    type(container.querySelector('#import-link') as HTMLInputElement, 'https://www.example-recipes.com/cake')
    await clickAndSettle(buttonWithText('Import'))

    expect(textOf()).toContain("doesn't let other websites read its pages")
    expect(textOf()).toContain('Save to cookbook')
  })

  it('opens a recipe sent by the Save to cookbook bookmark', () => {
    const payload = {
      u: 'https://www.example-recipes.com/pancakes',
      t: 'Pancakes | Example',
      r: {
        '@type': 'Recipe',
        name: 'Fluffy Pancakes',
        recipeYield: '4 servings',
        recipeCategory: 'Breakfast',
        recipeIngredient: ['1 1/2 cups flour', '2 eggs', '1 cup milk'],
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Whisk everything together.' },
          { '@type': 'HowToStep', text: 'Cook for 2 minutes per side.' },
        ],
      },
    }
    renderAt(`#/import?data=${encodeURIComponent(JSON.stringify(payload))}`)

    expect(textOf()).toContain('Fluffy Pancakes')
    expect(textOf()).toContain('3 ingredients')
    expect(textOf()).toContain('Breakfast')
    // The payload is dropped from the address bar once it has been read.
    expect(window.location.hash).toBe('#/')
  })
})
