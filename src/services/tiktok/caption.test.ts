import { describe, expect, it } from 'vitest'
import { titleFromCaption } from './caption'
import { PASTA_OEMBED_CAPTION } from './fixtures'

describe('titleFromCaption', () => {
  it('uses the name the creator put before "Ingredients"', () => {
    expect(titleFromCaption(PASTA_OEMBED_CAPTION)).toBe('One Pot Creamy Chicken Pasta')
  })

  it('stops at the first emoji and title-cases a lowercase caption', () => {
    expect(
      titleFromCaption('honey chipotle chicken wrap 🍯🌶️✨ - honey chipotle chicken made into a wrap #chickenwrap'),
    ).toBe('Honey Chipotle Chicken Wrap')
  })

  it('drops lead-in chatter and trailing link talk', () => {
    expect(titleFromCaption('Here is my Garlic Butter Salmon full recipe on my website')).toBe('Garlic Butter Salmon')
    expect(titleFromCaption('The best smash burgers! You need to try these')).toBe('Smash Burgers')
  })

  it('keeps long titles to a sensible length', () => {
    const title = titleFromCaption(
      'Crispy Chilli Beef With Sticky Soy Glaze And Quick Pickled Cucumbers Over Steamed Jasmine Rice 🔥 so good',
    )
    expect(title!.length).toBeLessThanOrEqual(60)
    expect(title).not.toMatch(/\s$/)
  })

  it('returns nothing for an empty caption', () => {
    expect(titleFromCaption('   ')).toBeUndefined()
    expect(titleFromCaption('#fyp #foodtok')).toBeUndefined()
  })
})
