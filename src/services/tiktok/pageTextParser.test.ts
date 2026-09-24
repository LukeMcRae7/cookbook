import { describe, expect, it } from 'vitest'
import {
  extractHandle,
  extractPageTitle,
  looksLikePageText,
  normalizePageText,
  readTikTokPageText,
} from './pageTextParser'
import { PASTA_PAGE_TEXT, WRAP_PAGE_TEXT } from './fixtures'

const linesOf = (text: string) => normalizePageText(text).split('\n').filter(Boolean)

describe('normalizePageText', () => {
  it('restores line breaks lost when copying from a rendered page', () => {
    const lines = linesOf('Red pepper flakesInstructionsSeason the chicken:Coat the breasts')
    expect(lines).toEqual([
      'Red pepper flakes',
      'Instructions',
      'Season the chicken:',
      'Coat the breasts',
    ])
  })

  it('splits a quantity glued onto the previous word', () => {
    expect(linesOf('1 tsp onion powderSalt and pepper')).toEqual([
      '1 tsp onion powder',
      'Salt and pepper',
    ])
    expect(linesOf('Chicken2 chicken breasts1 tbsp olive oil')).toEqual([
      'Chicken',
      '2 chicken breasts',
      '1 tbsp olive oil',
    ])
  })

  it('splits numbered steps glued onto the previous sentence', () => {
    // The step's label stays attached to its own sentence.
    expect(linesOf('Chill if time allows.2. Cook the chicken: Heat a pot')).toEqual([
      'Chill if time allows.',
      '2. Cook the chicken: Heat a pot',
    ])
  })

  it('leaves ordinary spaced prose alone', () => {
    expect(linesOf('Add the rice. Bring to a boil. Cover for 14 minutes.')).toEqual([
      'Add the rice. Bring to a boil. Cover for 14 minutes.',
    ])
  })
})

describe('page metadata', () => {
  it('reads the creator handle', () => {
    expect(extractHandle(linesOf(PASTA_PAGE_TEXT))).toBe('@dadsfoodtoday')
    expect(extractHandle(linesOf(WRAP_PAGE_TEXT))).toBe('@aflavorfulbite')
  })

  it('reads the dish name rather than a section label', () => {
    expect(extractPageTitle(linesOf(PASTA_PAGE_TEXT))).toBe('One Pot Creamy Chicken Pasta')
    expect(extractPageTitle(linesOf(WRAP_PAGE_TEXT))).toBe('Honey Chipotle Chicken Wrap Recipe')
  })

  it('recognises a page paste but not a plain spoken transcript', () => {
    expect(looksLikePageText(PASTA_PAGE_TEXT)).toBe(true)
    expect(looksLikePageText('Add two cups of flour and mix well.')).toBe(false)
  })
})

describe('readTikTokPageText — caption already holds the recipe', () => {
  const page = readTikTokPageText(PASTA_PAGE_TEXT)

  it('parses the recipe from the description and skips the duplicate summary', () => {
    expect(page.source).toBe('caption')
    expect(page.hasSummary).toBe(true)
    expect(page.summaryIgnored).toBe(true)
  })

  it('extracts every ingredient with its quantity and unit', () => {
    expect(page.recipe.ingredients.length).toBeGreaterThanOrEqual(15)
    expect(page.recipe.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quantity: 2, name: 'chicken breasts' }),
        expect.objectContaining({ quantity: 1, unit: 'tbsp', name: 'olive oil' }),
        expect.objectContaining({ quantity: 8, unit: 'oz', name: 'dry rigatoni' }),
        expect.objectContaining({ quantity: 24, unit: 'oz', name: 'heavy cream' }),
        // Listed once for the chicken and once for the sauce: each stays in its group.
        expect.objectContaining({ quantity: 1, unit: 'tsp', name: 'smoked paprika', group: 'Chicken' }),
        expect.objectContaining({ quantity: 1, unit: 'tsp', name: 'smoked paprika', group: 'Pasta & Sauce' }),
      ]),
    )
  })

  it('keeps grouped and unquantified entries', () => {
    const names = page.recipe.ingredients.map((i) => i.name)
    expect(names).toContain('salt and black pepper')
    expect(names).toContain('red pepper flakes')
    // "Chicken" and "Pasta & Sauce" are group headers, not ingredients.
    expect(names).not.toContain('pasta & sauce')
  })

  it('merges a step label with the sentence it introduces', () => {
    expect(page.recipe.directions).toHaveLength(5)
    expect(page.recipe.directions[0].text).toMatch(/^Season the chicken: Coat the chicken breasts/)
    expect(page.recipe.directions[4].text).toMatch(/^Finish and serve: Slice the rested chicken/)
  })

  it('attaches timers found in the steps', () => {
    expect(page.recipe.directions[0].timerSeconds).toBe(900)
    expect(page.recipe.directions[1].timerSeconds).toBe(120)
  })

  it('keeps the SEO link list and marketing prose out of the steps', () => {
    const all = page.recipe.directions.map((d) => d.text).join(' ')
    expect(all).not.toMatch(/Terrine|Morrisons|Icelandic/)
    expect(all).not.toMatch(/combines crispy, seasoned chicken breasts/)
  })

  it('still takes servings from the summary, which the description omits', () => {
    expect(page.recipe.servings).toBe(2)
  })

  it('reports a confident parse with no warnings', () => {
    expect(page.recipe.warnings).toEqual([])
    expect(page.recipe.confidence).toBeGreaterThan(0.8)
  })
})

describe('readTikTokPageText — summary only describes the dish', () => {
  const page = readTikTokPageText(WRAP_PAGE_TEXT)

  it('finds no recipe and says so instead of inventing one', () => {
    expect(page.recipe.ingredients).toHaveLength(0)
    expect(page.recipe.directions).toHaveLength(0)
    expect(page.recipe.warnings).toContain('no-recipe-content')
    expect(page.recipe.confidence).toBe(0)
    expect(page.source).toBe('none')
  })

  it('notices the creator hosts the real recipe elsewhere', () => {
    expect(page.mentionsExternalRecipe).toBe(true)
  })

  it('still recovers the dish name and creator', () => {
    expect(page.title).toBe('Honey Chipotle Chicken Wrap Recipe')
    expect(page.authorHandle).toBe('@aflavorfulbite')
  })
})

describe('readTikTokPageText — plain transcript still works', () => {
  it('falls through to prose parsing when there is no page structure', () => {
    const page = readTikTokPageText(
      'Add two cups of flour, one teaspoon of salt, and three eggs. Mix everything together and bake at 350 degrees for 25 minutes.',
    )
    expect(page.hasSummary).toBe(false)
    expect(page.source).toBe('caption')
    expect(page.recipe.ingredients).toHaveLength(3)
    expect(page.recipe.directions).toHaveLength(2)
  })
})
