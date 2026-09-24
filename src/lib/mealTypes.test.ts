import { describe, expect, it } from 'vitest'
import { classifyMealTypes, extractHashtags } from './mealTypes'

describe('classifyMealTypes', () => {
  it('reads the dish from its title', () => {
    expect(classifyMealTypes({ title: 'Brown Butter Chocolate Chip Cookies' })).toEqual(['dessert'])
    expect(classifyMealTypes({ title: 'Fluffy Buttermilk Pancakes' })).toEqual(['breakfast'])
    expect(classifyMealTypes({ title: 'Chicken Tikka Masala' })).toEqual(['dinner'])
    expect(classifyMealTypes({ title: 'Iced Brown Sugar Latte' })).toEqual(['drink'])
    expect(classifyMealTypes({ title: 'Garlic Parmesan Roasted Potatoes' })).toEqual(['side'])
  })

  it('trusts an explicit schema.org category most', () => {
    expect(classifyMealTypes({ title: 'Grandma’s Special', categories: ['Dessert'] })).toEqual(['dessert'])
  })

  it('counts hashtags, including compound ones', () => {
    expect(classifyMealTypes({ title: 'Creamy Chicken', tags: ['familydinner', 'easyrecipe'] })).toContain('dinner')
  })

  it('can return two meals when both fit', () => {
    expect(classifyMealTypes({ title: 'Chicken Caesar Wrap', tags: ['lunch', 'dinner'] })).toEqual(
      expect.arrayContaining(['lunch', 'dinner']),
    )
  })

  it('stays quiet when there is no signal', () => {
    expect(classifyMealTypes({ title: 'Grandma’s Special' })).toEqual([])
  })
})

describe('extractHashtags', () => {
  it('pulls hashtags out of a caption', () => {
    expect(extractHashtags('so good #easyrecipe #pasta #familydinner')).toEqual(['easyrecipe', 'pasta', 'familydinner'])
  })
})
