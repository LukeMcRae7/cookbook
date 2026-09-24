import { describe, expect, it } from 'vitest'
import { findIngredientMentions, namesFor } from './mentions'
import type { Ingredient } from '../types/recipe'

function ingredient(id: string, name: string, group?: string): Ingredient {
  return { id, name, group, checked: false }
}

function mentioned(text: string, ingredients: Ingredient[]) {
  return findIngredientMentions(text, ingredients).map((mention) => [
    text.slice(mention.start, mention.end),
    mention.ingredients.map((item) => item.id),
  ])
}

describe('ingredient mentions in steps', () => {
  it('knows the short names a step uses', () => {
    expect(namesFor(ingredient('a', 'boneless skinless chicken breasts'))).toEqual(
      expect.arrayContaining(['chicken breasts', 'chicken breast', 'chicken']),
    )
    expect(namesFor(ingredient('b', 'extra virgin olive oil'))).toEqual(
      expect.arrayContaining(['olive oil', 'oil']),
    )
    expect(namesFor(ingredient('c', 'garlic cloves'))).toContain('garlic')
    expect(namesFor(ingredient('e', 'ginger root'))).toContain('ginger')
    expect(namesFor(ingredient('e', 'ginger root'))).not.toContain('root')
    expect(namesFor(ingredient('f', 'vanilla extract'))).toContain('vanilla')
    // "the sauce" is not the soy sauce
    expect(namesFor(ingredient('d', 'soy sauce'))).not.toContain('sauce')
  })

  it('prefers the longest name and keeps words whole', () => {
    const items = [ingredient('oil', 'olive oil'), ingredient('onion', 'onions'), ingredient('egg', 'eggs')]
    expect(mentioned('Heat the olive oil, add the onion and cook. Beat the eggs.', items)).toEqual([
      ['olive oil', ['oil']],
      ['onion', ['onion']],
      ['eggs', ['egg']],
    ])
    // "eggplant" does not mention eggs
    expect(mentioned('Slice the eggplant.', items)).toEqual([])
  })

  it('points a shared name at every ingredient it could mean', () => {
    const items = [
      ingredient('p1', 'smoked paprika', 'Chicken'),
      ingredient('p2', 'smoked paprika', 'Sauce'),
      ingredient('s', 'salt'),
    ]
    expect(mentioned('Season with the smoked paprika and salt.', items)).toEqual([
      ['smoked paprika', ['p1', 'p2']],
      ['salt', ['s']],
    ])
  })

  it('matches each alternative in "salt and pepper"', () => {
    const items = [ingredient('sp', 'salt and black pepper')]
    expect(mentioned('Season with salt, then pepper.', items)).toEqual([
      ['salt', ['sp']],
      ['pepper', ['sp']],
    ])
  })
})
