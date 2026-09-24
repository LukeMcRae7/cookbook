import { describe, expect, it } from 'vitest'
import { parseIngredientPhrase, dedupeIngredients } from './ingredientParser'
import { parseNumericToken } from './numberParser'
import { extractDuration, extractTemperature, tidyDirectionText } from './directionParser'
import { cleanTranscript, extractCalories, parseRecipe } from './recipeParser'
import { classifyHeading } from './sections'
import { PASTA_OEMBED_CAPTION } from '../tiktok/fixtures'

/**
 * Cases found in real captions and on real recipe sites. Each one failed
 * before the fix that this file pins in place.
 */

const list = (phrase: string) => parseIngredientPhrase(phrase, { strict: false })

describe('numbers as recipe sites write them', () => {
  it('reads hyphenated mixed numbers', () => {
    expect(parseNumericToken('1-1/2')).toBe(1.5)
  })

  it('reads decimal commas but not thousands separators', () => {
    expect(parseNumericToken('1,5')).toBe(1.5)
    expect(list('1,5 kg potatoes')).toMatchObject({ quantity: 1.5, unit: 'kg', name: 'potatoes' })
  })

  it('keeps a decimal quantity whole instead of reading "1." as a list number', () => {
    const recipe = parseRecipe('Ingredients\n1.5 cups sugar\n2 cups flour\nInstructions\nMix well.')
    expect(recipe.ingredients[0]).toMatchObject({ quantity: 1.5, unit: 'cup', name: 'sugar' })
  })

  it('keeps ranges intact in a written list', () => {
    const recipe = parseRecipe('Ingredients\n1–2 tbsp butter\nInstructions\nMelt the butter.')
    expect(recipe.ingredients[0]).toMatchObject({ quantity: 1, displayQuantity: '1-2', unit: 'tbsp' })
  })
})

describe('ingredient lines from recipe sites', () => {
  it('turns a parenthetical package size into a note', () => {
    expect(list('1 (14.5 oz) can diced tomatoes')).toMatchObject({
      quantity: 1,
      unit: 'can',
      name: 'tomatoes',
      preparation: 'diced, 14.5 oz',
    })
  })

  it('reads a hyphenated package size between count and container', () => {
    expect(list('one 14-ounce can coconut milk')).toMatchObject({
      quantity: 1,
      unit: 'can',
      name: 'coconut milk',
      preparation: '14 ounce',
    })
  })

  it('handles nested parentheses', () => {
    const garlic = list('12 cloves garlic (minced (~1.5 tbsp))')
    expect(garlic).toMatchObject({ quantity: 12, unit: 'clove', name: 'garlic' })
    expect(garlic?.preparation).not.toMatch(/[()]/)
  })

  it('drops prices and footnote references', () => {
    expect(list('2 tsp smoked paprika ($0.20)')?.preparation).toBeUndefined()
    expect(list('1 tsp garam masala (Note 2)')?.preparation).toBeUndefined()
    expect(list('3 green onions*')).toMatchObject({ name: 'green onions' })
  })

  it('does not split at a comma between adjectives', () => {
    expect(list('1 lb. boneless, skinless chicken breast')).toMatchObject({
      quantity: 1,
      unit: 'lb',
      name: 'boneless skinless chicken breast',
    })
    expect(list('3 cloves garlic, minced')).toMatchObject({ name: 'garlic', preparation: 'minced' })
  })

  it('keeps the first of two measures and notes the conversion', () => {
    expect(list('600g / 1.2 lb chicken thigh')).toMatchObject({
      quantity: 600,
      unit: 'g',
      name: 'chicken thigh',
      preparation: '1.2 lb',
    })
    // A plain fraction is not a pair of measures.
    expect(list('1/2 tsp garlic powder')).toMatchObject({ quantity: 0.5, unit: 'tsp', name: 'garlic powder' })
    expect(list('1 2/3 cup tomato passata')).toMatchObject({ unit: 'cup', name: 'tomato passata' })
  })

  it('keeps a trailing note in a written list', () => {
    expect(list('1 tbsp sunflower oil plus a little extra for frying')).toMatchObject({
      quantity: 1,
      unit: 'tbsp',
      name: 'sunflower oil',
      preparation: 'plus a little extra for frying',
    })
  })

  it('strips recipe-card checkbox bullets', () => {
    expect(list('▢ 2 cups flour')).toMatchObject({ quantity: 2, unit: 'cup', name: 'flour' })
  })
})

describe('duplicates', () => {
  it('adds up the same ingredient listed twice with the same unit', () => {
    const merged = dedupeIngredients([list('1 tsp smoked paprika')!, list('1 tsp smoked paprika')!])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ quantity: 2, displayQuantity: '2' })
  })

  it('does not add up ranges', () => {
    const merged = dedupeIngredients([list('1-2 tbsp butter')!, list('1-2 tbsp butter')!])
    expect(merged[0].displayQuantity).toBe('1-2')
  })
})

describe('directions', () => {
  it('strips "Step 1:" markers from the text', () => {
    expect(tidyDirectionText('Step 2: Bake until golden')).toBe('Bake until golden.')
    expect(tidyDirectionText('3. Serve')).toBe('Serve.')
  })

  it('does not strip the start of a range or a decimal', () => {
    expect(tidyDirectionText('1-2 minutes per side is plenty')).toBe('1-2 minutes per side is plenty.')
  })

  it('never treats a "Step 1: …" line as a heading', () => {
    expect(classifyHeading('Step 1: Preheat the oven to 350.')).toBeNull()
    expect(classifyHeading('Note: bake it a little longer')).toBeNull()
    expect(classifyHeading('Ingredients (serves 2-4):')).toBe('ingredients')
    expect(classifyHeading('Step-by-step Instructions')).toBe('directions')
  })

  it('reads a bare oven temperature from context', () => {
    expect(extractTemperature('Preheat the oven to 350')).toEqual({ value: 350, unit: 'F' })
    expect(extractTemperature('Preheat your oven to 200')).toEqual({ value: 200, unit: 'C' })
    expect(extractTemperature('Bake at 425 for 20 minutes')).toEqual({ value: 425, unit: 'F' })
    expect(extractTemperature('Add 250 g of flour')).toBeNull()
  })

  it('reads compound and mixed-number durations', () => {
    expect(extractDuration('roast for 1 hour 30 minutes')?.seconds).toBe(5400)
    expect(extractDuration('braise for 1 hr and 15 min')?.seconds).toBe(4500)
    expect(extractDuration('simmer for 1 1/2 hours')?.seconds).toBe(5400)
    expect(extractDuration('rest for half an hour')?.seconds).toBe(1800)
    expect(extractDuration('an hour and a half in the oven')?.seconds).toBe(5400)
  })

  it('reads a numbered list written with keycap emoji', () => {
    const recipe = parseRecipe('Instructions\n1️⃣ Preheat the oven\n2️⃣ Bake for 20 minutes')
    expect(recipe.directions.map((d) => d.text)).toEqual(['Preheat the oven.', 'Bake for 20 minutes.'])
  })

  it('normalises degree look-alikes', () => {
    expect(cleanTranscript('Bake at 180℃')).toBe('Bake at 180°C')
    expect(cleanTranscript('Bake at 350ºF')).toBe('Bake at 350°F')
  })
})

describe('metadata', () => {
  it('extracts calories', () => {
    expect(extractCalories('425 calories per serving')).toBe(425)
    expect(extractCalories('Calories: 610')).toBe(610)
    expect(extractCalories('no nutrition here')).toBeUndefined()
  })
})

describe('a TikTok caption read from a link (newlines flattened)', () => {
  const recipe = parseRecipe(PASTA_OEMBED_CAPTION)

  it('recovers every ingredient from the one-line list', () => {
    expect(recipe.ingredients.length).toBeGreaterThanOrEqual(15)
    expect(recipe.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quantity: 2, name: 'chicken breasts' }),
        expect.objectContaining({ displayQuantity: '1-2', unit: 'tbsp', name: 'butter' }),
        expect.objectContaining({ quantity: 8, unit: 'oz', name: 'dry rigatoni' }),
        expect.objectContaining({ name: 'salt and black pepper', preparation: 'to taste' }),
        expect.objectContaining({ name: 'fresh parsley', preparation: 'chopped' }),
        expect.objectContaining({ name: 'red pepper flakes' }),
      ]),
    )
    const names = recipe.ingredients.map((i) => i.name)
    expect(names).not.toContain('chicken')
    expect(names.join(' ')).not.toMatch(/optional|garnish|pasta & sauce/)
  })

  it('splits the one-line instructions at each labelled step', () => {
    expect(recipe.directions.map((d) => d.text.split(':')[0])).toEqual([
      'Season the chicken',
      'Cook the chicken',
      'Cook the pasta',
      'Add the cheese',
      'Finish and serve',
    ])
    expect(recipe.directions[0].timerSeconds).toBe(900)
  })

  it('reports a confident parse', () => {
    expect(recipe.warnings).toEqual([])
    expect(recipe.confidence).toBeGreaterThan(0.8)
  })
})
