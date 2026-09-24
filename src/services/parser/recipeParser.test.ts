import { describe, expect, it } from 'vitest'
import { formatQuantity, parseLeadingQuantity, parseNumericToken } from './numberParser'
import { canonicalUnit, formatUnit } from './units'
import { parseIngredientPhrase, splitIngredientChunks } from './ingredientParser'
import {
  extractDuration,
  extractTemperature,
  normaliseTemperatureText,
  splitInstructionClauses,
  splitSentences,
} from './directionParser'
import { extractServings, parseRecipe } from './recipeParser'

describe('numberParser', () => {
  it('reads plain numbers and decimals', () => {
    expect(parseNumericToken('2')).toBe(2)
    expect(parseNumericToken('1.5')).toBe(1.5)
    expect(parseNumericToken('16')).toBe(16)
  })

  it('reads written numbers', () => {
    expect(parseNumericToken('two')).toBe(2)
    expect(parseNumericToken('three')).toBe(3)
    expect(parseNumericToken('twelve')).toBe(12)
    expect(parseNumericToken('twenty-five')).toBe(25)
    expect(parseNumericToken('a')).toBe(1)
    expect(parseNumericToken('couple')).toBe(2)
  })

  it('reads fractions in every common form', () => {
    expect(parseNumericToken('1/2')).toBe(0.5)
    expect(parseNumericToken('3/4')).toBe(0.75)
    expect(parseNumericToken('½')).toBe(0.5)
    expect(parseNumericToken('1½')).toBe(1.5)
    expect(parseNumericToken('half')).toBe(0.5)
    expect(parseNumericToken('quarter')).toBe(0.25)
  })

  it('reads mixed numbers and ranges', () => {
    expect(parseLeadingQuantity(['1', '1/2', 'cups'])?.value).toBe(1.5)
    expect(parseLeadingQuantity(['one', 'and', 'a', 'half', 'cups'])?.value).toBe(1.5)
    const range = parseLeadingQuantity(['2', 'to', '3', 'cloves'])
    expect(range?.value).toBe(2)
    expect(range?.isRange).toBe(true)
  })

  it('formats quantities as readable fractions', () => {
    expect(formatQuantity(0.5)).toBe('1/2')
    expect(formatQuantity(0.25)).toBe('1/4')
    expect(formatQuantity(0.75)).toBe('3/4')
    expect(formatQuantity(1 / 3)).toBe('1/3')
    expect(formatQuantity(2.5)).toBe('2 1/2')
    expect(formatQuantity(3)).toBe('3')
    expect(formatQuantity(0.6666666)).toBe('2/3')
  })
})

describe('units', () => {
  it('canonicalises spoken unit names', () => {
    expect(canonicalUnit('tablespoons')).toBe('tbsp')
    expect(canonicalUnit('teaspoon')).toBe('tsp')
    expect(canonicalUnit('ounces')).toBe('oz')
    expect(canonicalUnit('cups')).toBe('cup')
    expect(canonicalUnit('cloves')).toBe('clove')
    expect(canonicalUnit('banana')).toBeNull()
  })

  it('pluralises only the units that read naturally in plural', () => {
    expect(formatUnit('cup', 2)).toBe('cups')
    expect(formatUnit('tbsp', 2)).toBe('tbsp')
    expect(formatUnit('clove', 3)).toBe('cloves')
    expect(formatUnit('pinch', 2)).toBe('pinches')
    expect(formatUnit('cup', 1)).toBe('cup')
  })
})

describe('ingredientParser', () => {
  it('parses written quantity + unit + name', () => {
    expect(parseIngredientPhrase('two cups of flour')).toMatchObject({
      quantity: 2,
      unit: 'cup',
      name: 'flour',
    })
  })

  it('parses fractional quantities', () => {
    expect(parseIngredientPhrase('1/2 cup olive oil')).toMatchObject({
      quantity: 0.5,
      displayQuantity: '1/2',
      unit: 'cup',
      name: 'olive oil',
    })
  })

  it('parses a preparation clause after a comma', () => {
    expect(parseIngredientPhrase('three cloves garlic, minced')).toMatchObject({
      quantity: 3,
      unit: 'clove',
      name: 'garlic',
      preparation: 'minced',
    })
  })

  it('parses weights with preparation', () => {
    expect(parseIngredientPhrase('16 ounces chicken breast, diced')).toMatchObject({
      quantity: 16,
      unit: 'oz',
      name: 'chicken breast',
      preparation: 'diced',
    })
  })

  it('lifts a leading preparation word out of the name', () => {
    expect(parseIngredientPhrase('1 cup finely chopped onion')).toMatchObject({
      unit: 'cup',
      name: 'onion',
      preparation: 'finely chopped',
    })
  })

  it('handles a quantity with no unit', () => {
    expect(parseIngredientPhrase('three eggs')).toMatchObject({
      quantity: 3,
      name: 'eggs',
    })
    expect(parseIngredientPhrase('three eggs')?.unit).toBeUndefined()
  })

  it('keeps known foods that have no quantity at all', () => {
    const parsed = parseIngredientPhrase('salt')
    expect(parsed?.name).toBe('salt')
    expect(parsed?.quantity).toBeUndefined()
  })

  it('rejects phrases that are instructions rather than ingredients', () => {
    expect(parseIngredientPhrase('cook until browned on all sides')).toBeNull()
    expect(parseIngredientPhrase('bake for 25 minutes')).toBeNull()
    expect(parseIngredientPhrase('mix everything together')).toBeNull()
  })

  it('splits a spoken ingredient list into chunks', () => {
    expect(
      splitIngredientChunks('two cups of flour, one teaspoon of salt, and three eggs'),
    ).toEqual(['two cups of flour', 'one teaspoon of salt', 'three eggs'])
  })

  it('does not split "salt and pepper"', () => {
    expect(splitIngredientChunks('a pinch of salt and pepper')).toEqual([
      'a pinch of salt and pepper',
    ])
  })
})

describe('directionParser', () => {
  it('splits sentences without breaking decimals', () => {
    expect(splitSentences('Mix it. Bake at 350.5 degrees. Done.')).toEqual([
      'Mix it.',
      'Bake at 350.5 degrees.',
      'Done.',
    ])
  })

  it('extracts cooking times', () => {
    expect(extractDuration('bake for 25 minutes')?.seconds).toBe(1500)
    expect(extractDuration('simmer 5 min')?.seconds).toBe(300)
    expect(extractDuration('rest for 1 hour')?.seconds).toBe(3600)
    expect(extractDuration('cook for thirty seconds')?.seconds).toBe(30)
    expect(extractDuration('stir it well')).toBeNull()
  })

  it('takes the lower bound of a time range', () => {
    expect(extractDuration('cook for 3-4 minutes')?.seconds).toBe(180)
  })

  it('extracts temperatures and assumes Fahrenheit above 100 degrees', () => {
    expect(extractTemperature('bake at 350 degrees')).toEqual({ value: 350, unit: 'F' })
    expect(extractTemperature('bake at 180 degrees C')).toEqual({ value: 180, unit: 'C' })
    expect(extractTemperature('heat to 400°F')).toEqual({ value: 400, unit: 'F' })
    expect(extractTemperature('stir gently')).toBeNull()
  })

  it('normalises spoken temperatures without eating the next word', () => {
    expect(normaliseTemperatureText('bake at 350 degrees for 25 minutes')).toBe(
      'bake at 350°F for 25 minutes',
    )
  })

  it('splits a sentence into separate instructions at a second verb', () => {
    expect(
      splitInstructionClauses('Mix everything together and bake at 350 degrees for 25 minutes'),
    ).toEqual([
      'Mix everything together',
      'bake at 350 degrees for 25 minutes',
    ])
  })
})

describe('parseRecipe', () => {
  it('handles the canonical example end to end', () => {
    const result = parseRecipe(
      'Add two cups of flour, one teaspoon of salt, and three eggs. Mix everything together and bake at 350 degrees for 25 minutes.',
    )

    expect(result.ingredients).toHaveLength(3)
    expect(result.ingredients[0]).toMatchObject({ quantity: 2, unit: 'cup', name: 'flour' })
    expect(result.ingredients[1]).toMatchObject({ quantity: 1, unit: 'tsp', name: 'salt' })
    expect(result.ingredients[2]).toMatchObject({ quantity: 3, name: 'eggs' })

    expect(result.directions.map((d) => d.text)).toEqual([
      'Mix everything together.',
      'Bake at 350°F for 25 minutes.',
    ])
    expect(result.directions[1].temperature).toEqual({ value: 350, unit: 'F' })
    expect(result.directions[1].timerSeconds).toBe(1500)
  })

  it('numbers directions sequentially', () => {
    const result = parseRecipe(
      'Heat the oil in a pan. Add the chicken and cook until browned. Pour in the sauce and simmer for 10 minutes.',
    )
    expect(result.directions.length).toBeGreaterThanOrEqual(3)
    expect(result.directions.map((d) => d.step)).toEqual(
      result.directions.map((_, index) => index + 1),
    )
  })

  it('reads a structured caption with headings', () => {
    const result = parseRecipe(
      [
        'Chicken Curry',
        'Ingredients:',
        '- 16 oz chicken breasts, diced',
        '- 1 cup basmati rice',
        '- 2 tbsp olive oil',
        'Directions:',
        '1. Heat olive oil in a skillet.',
        '2. Simmer for 20 minutes.',
      ].join('\n'),
    )

    expect(result.title).toBe('Chicken Curry')
    expect(result.ingredients.map((i) => i.name)).toEqual([
      'chicken breasts',
      'basmati rice',
      'olive oil',
    ])
    expect(result.directions).toHaveLength(2)
    expect(result.directions[1].timerSeconds).toBe(1200)
  })

  it('flags a transcript with no quantities', () => {
    const result = parseRecipe('Add flour and salt. Mix it well.')
    expect(result.warnings).toContain('missing-quantities')
    expect(result.ingredients.length).toBeGreaterThan(0)
  })

  it('ignores chatter and reports that nothing was found', () => {
    const result = parseRecipe(
      "Hey guys welcome back to my channel. Don't forget to like and subscribe. Link in my bio.",
    )
    expect(result.ingredients).toHaveLength(0)
    expect(result.directions).toHaveLength(0)
    expect(result.warnings).toContain('no-recipe-content')
    expect(result.confidence).toBe(0)
  })

  it('reports an empty transcript', () => {
    const result = parseRecipe('   ')
    expect(result.warnings).toContain('empty-transcript')
  })

  it('strips hashtags, emoji and bracketed noise', () => {
    const result = parseRecipe(
      '[Music] Add 2 cups of flour 🍰 and mix well. #baking #fyp',
    )
    expect(result.ingredients[0]).toMatchObject({ quantity: 2, unit: 'cup', name: 'flour' })
  })

  it('picks up servings', () => {
    expect(extractServings('This recipe serves 4 people')).toBe(4)
    expect(extractServings('Makes 12 cookies')).toBe(12)
    expect(extractServings('no servings here')).toBeUndefined()
  })

  it('sums recognised durations into a total time', () => {
    const result = parseRecipe('Simmer for 20 minutes. Bake for 25 minutes.')
    expect(result.totalTime).toBe(45)
  })
})
