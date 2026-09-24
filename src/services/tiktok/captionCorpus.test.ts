import { describe, expect, it } from 'vitest'
import corpus from './captionCorpus.json'
import { recipeFromCaption } from '../import/tiktokImport'
import type { ImportResult } from '../import/types'

/**
 * 29 real TikTok captions, exactly as TikTok's oEmbed endpoint returns them
 * (newlines flattened), covering the shapes seen in the wild: headed lists,
 * no headings at all, bullets of every kind, "~Group~" labels, sub-groups,
 * sectioned methods, footnotes, and captions with no recipe in them.
 *
 * Counts are pinned so any change in behaviour is a deliberate one.
 */

function read(handle: string, videoId?: string): ImportResult {
  const entry = corpus.find(
    (item) => item.url.includes(`@${handle}/`) && (!videoId || item.url.endsWith(videoId)),
  )
  if (!entry) throw new Error(`No caption for @${handle}`)
  return recipeFromCaption(entry.caption, { origin: 'tiktok', sourceUrl: entry.url, sourceLabel: 'TikTok' })
}

const names = (result: ImportResult) => result.parsed.ingredients.map((i) => i.name)
const groups = (result: ImportResult) => Array.from(new Set(result.parsed.ingredients.map((i) => i.group ?? '')))

describe('real TikTok captions', () => {
  const expectations: [handle: string, videoId: string | undefined, title: string, ingredients: number, steps: number][] = [
    ['stealth_health_life', undefined, 'Macro-Friendly Sausage Egg & Cheese Breakfast Sandwiches', 21, 4],
    ['dadsfoodtoday', undefined, 'One Pot Creamy Chicken Pasta', 23, 5],
    ['tylerbutt_eats', '7481377803267509526', '30-Min Marry Me Chicken', 19, 5],
    ['theshayspence', undefined, 'Rosé Shrimp Pasta', 12, 8],
    ['allrecipes', '7527447896430628126', "Poor Man's Pasta", 15, 17],
    ['butterworthdasyrup', undefined, 'TikTok Pasta', 7, 1],
    ['allrecipes', '7574962382263307550', 'Peas and Pancetta Pasta', 11, 19],
    ['allrecipes', '7509605547784572191', 'Spaghetti', 11, 6],
    ['bankobake', undefined, 'Vanilla Cake', 14, 12],
    ['bakingsecrets', undefined, 'Moist Chocolate Cake', 8, 1],
    ['thechowdown', '7332250135440952622', 'Salmon Rice Bowls', 15, 3],
    ['everything_delish', '7466844873782725893', 'Spicy Salmon Rice Bowls', 15, 4],
    ['tylerbutt_eats', '7488408610939145494', '20-Min Salmon & Rice Bowl', 13, 4],
    ['lazypotnoodle', undefined, 'Salmon rice bowl', 18, 7],
    ['thechowdown', '7219392172401904942', 'Salmon Rice Bowls', 21, 5],
    ['maryamzekria', undefined, 'Salmon Bowls on Rotation', 17, 3],
    ['brandongouveia', undefined, 'Raspberry Overnight Oat Smoothie', 9, 4],
    ['mitchcuisine', '7486780431338179862', 'Healthy breakfast with blueberry, oats and banana', 7, 3],
    ['nicole_thenomad', undefined, 'Peanut butter oatmeal smoothie', 9, 2],
    ['hannahmagee_rd', undefined, 'Oatmeal Peanut Butter Smoothie', 6, 0],
    ['mitchcuisine', '7436379641293688096', 'Overnight Oats', 5, 1],
    ['fayepmills', undefined, 'Vegetarian Soup', 14, 3],
    ['everything_delish', '7273235476650233093', 'Creamy Vegetable Soup', 15, 0],
  ]

  it.each(expectations)('@%s %s → "%s"', (handle, videoId, title, ingredients, steps) => {
    const result = read(handle, videoId)
    expect(result.title).toBe(title)
    expect(result.parsed.ingredients).toHaveLength(ingredients)
    expect(result.parsed.directions).toHaveLength(steps)
    // Nothing that is plainly not food should survive as an ingredient.
    for (const name of names(result)) {
      expect(name).not.toMatch(/^(?:serves|diced|sliced|peeled|thanks|enjoy)$|\b(?:recipe|website|bio)\b/)
    }
  })

  it('says so when a caption holds no recipe', () => {
    for (const handle of ['gimme.delicious', 't_rev_cooks', 'thatrecipe.us', 'makayla_thomas_fit']) {
      const result = read(handle)
      expect(result.parsed.warnings).toContain('no-recipe-content')
      expect(result.notices.length).toBeGreaterThan(0)
    }
  })

  it('points at the creator’s site when the recipe lives there', () => {
    expect(read('hi.itshollyb').notices[0].message).toMatch(/website/)
  })
})

describe('what the corpus proves', () => {
  it('reads glued amounts, sub-groups and footnotes (the reported failure)', () => {
    const result = read('stealth_health_life')
    expect(groups(result)).toEqual(['', 'Season with', 'Sheet pan eggs', 'Spicy mayo'])
    expect(result.parsed.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quantity: 8, unit: 'oz', name: 'turkey sausage' }),
        expect.objectContaining({ quantity: 200, unit: 'g', name: 'egg whites', group: 'Sheet pan eggs' }),
        expect.objectContaining({ quantity: 1, unit: 'tsp', name: 'corn starch' }),
        expect.objectContaining({ quantity: 15, unit: 'g', name: 'gochujang', group: 'Spicy mayo' }),
      ]),
    )
    expect(result.parsed.notes).toMatch(/^The reason I use a combo/)
    expect(result.parsed.directions[0].section).toBe('Reheat (from frozen)')
    expect(result.parsed.directions[3].text).toContain('425°F (oven)')
  })

  it('finds a list and a method that have no headings', () => {
    const result = read('butterworthdasyrup')
    expect(names(result)).toEqual(['tomato', 'shallot', 'garlic', 'olive oil', 'salt', 'thyme', 'feta'])
    // "Feta" then "8 oz block": one ingredient written in two pieces.
    expect(result.parsed.ingredients[6]).toMatchObject({ quantity: 8, unit: 'oz', preparation: 'block' })
    expect(result.parsed.directions[0].text).toBe('Put it in a pot and bake at 400°F for 40 min.')
  })

  it('splits flattened bullets and keeps a dangling group heading', () => {
    const result = read('tylerbutt_eats', '7481377803267509526')
    expect(groups(result)).toEqual(['', 'Sauce'])
    expect(result.parsed.ingredients.find((i) => i.name === 'sun dried tomatoes')).toMatchObject({
      unit: 'handful',
      preparation: 'chopped, or 60 g',
    })
  })

  it('reads "~Group~" labels and sectioned methods', () => {
    expect(groups(read('thechowdown', '7219392172401904942'))).toEqual([
      'Salmon',
      'Quick pickled cucumbers',
      'Sauce',
      'Serving',
    ])
    const cake = read('bankobake')
    expect(groups(cake)).toEqual(['Cake', 'Buttercream'])
    expect(Array.from(new Set(cake.parsed.directions.map((d) => d.section)))).toEqual([
      'Cake',
      'Buttercream',
      'Decorating',
    ])
  })

  it('expands one amount written for a list of spices', () => {
    const result = read('maryamzekria')
    for (const spice of ['ginger powder', 'onion powder', 'garlic powder', 'paprika']) {
      expect(result.parsed.ingredients.find((i) => i.name === spice)).toMatchObject({ quantity: 1, unit: 'tsp' })
    }
  })

  it('splits a method with no full stops between its steps', () => {
    const steps = read('fayepmills').parsed.directions.map((d) => d.text)
    expect(steps[0]).toMatch(/^Chop and gently fry/)
    expect(steps[1]).toMatch(/^Chop carrot and swede/)
  })
})
