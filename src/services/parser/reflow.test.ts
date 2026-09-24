import { describe, expect, it } from 'vitest'
import {
  isRunOnIngredientLine,
  reflowInlineHeadings,
  splitRunOnDirections,
  splitRunOnIngredients,
} from './reflow'

describe('reflowInlineHeadings', () => {
  it('breaks a flattened caption at its headings', () => {
    const flat =
      'My favourite pasta, ready in twenty minutes flat. One Pot Pasta: Ingredients 2 cups pasta 1 cup cream Instructions Boil the pasta. Stir in the cream.'
    expect(reflowInlineHeadings(flat).split('\n')).toEqual([
      'My favourite pasta, ready in twenty minutes flat. One Pot Pasta: ',
      'Ingredients',
      ' 2 cups pasta 1 cup cream ',
      'Instructions',
      ' Boil the pasta. Stir in the cream.',
    ])
  })

  it('leaves short lines and lowercase mentions alone', () => {
    expect(reflowInlineHeadings('Ingredients 2 cups flour')).toBe('Ingredients 2 cups flour')
    const prose =
      'I always keep these ingredients around because they make weeknight dinners so easy, and nothing here is fancy at all really.'
    expect(reflowInlineHeadings(prose)).toBe(prose)
  })
})

describe('run-on ingredient lines', () => {
  it('detects more quantities than commas can explain', () => {
    expect(isRunOnIngredientLine('2 chicken breasts 1 tbsp olive oil 1 tsp salt')).toBe(true)
    expect(isRunOnIngredientLine('2 chicken breasts, 1 tbsp olive oil')).toBe(false)
    expect(isRunOnIngredientLine('1 1/2 cups flour')).toBe(false)
  })

  it('splits at quantities and at item boundaries', () => {
    expect(
      splitRunOnIngredients(
        'Chicken 2 chicken breasts 1–2 tbsp butter 1 tsp Cajun seasoning Salt and pepper, to taste Sauce 24 oz heavy cream (add more if needed) Fresh parsley, chopped Grated Parmesan cheese',
      ),
    ).toEqual([
      'Chicken',
      '2 chicken breasts',
      '1–2 tbsp butter',
      '1 tsp Cajun seasoning',
      'Salt and pepper, to taste',
      'Sauce',
      '24 oz heavy cream (add more if needed)',
      'Fresh parsley, chopped',
      'Grated Parmesan cheese',
    ])
  })

  it('does not split a proper noun away from its adjective', () => {
    expect(splitRunOnIngredients('2 tsp dried Italian seasoning 1/2 cup grated Parmesan')).toEqual([
      '2 tsp dried Italian seasoning',
      '1/2 cup grated Parmesan',
    ])
  })
})

describe('run-on directions', () => {
  it('prefers the author’s step labels', () => {
    expect(
      splitRunOnDirections('Prep the chicken: Season it well. Pat dry. Cook the chicken: Sear for 3 minutes.'),
    ).toEqual(['Prep the chicken: Season it well. Pat dry.', 'Cook the chicken: Sear for 3 minutes.'])
  })

  it('uses numbering when there are no labels', () => {
    expect(splitRunOnDirections('1. Boil the pasta. 2. Drain it well. 3. Toss with sauce.')).toEqual([
      '1. Boil the pasta.',
      '2. Drain it well.',
      '3. Toss with sauce.',
    ])
  })

  it('otherwise starts a step at each instruction and keeps asides attached', () => {
    expect(
      splitRunOnDirections('Preheat the oven. It takes a while. Mix the flour and sugar. Bake for 25 minutes.'),
    ).toEqual(['Preheat the oven. It takes a while.', 'Mix the flour and sugar.', 'Bake for 25 minutes.'])
  })
})
