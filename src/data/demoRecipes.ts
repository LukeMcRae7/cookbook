import type { Direction, Ingredient, Recipe } from '../types/recipe'

/** Hand-authored so the app is worth looking at before you import anything. */

let seq = 0
const ing = (
  name: string,
  quantity?: number,
  unit?: string,
  preparation?: string,
  displayQuantity?: string,
): Ingredient => {
  seq += 1
  return {
    id: `demo-ing-${seq}`,
    name,
    quantity,
    displayQuantity: quantity !== undefined ? (displayQuantity ?? String(quantity)) : undefined,
    unit,
    preparation,
    checked: false,
  }
}

const dir = (
  step: number,
  text: string,
  timerSeconds?: number,
  temperature?: Direction['temperature'],
): Direction => ({ id: `demo-dir-${step}-${seq++}`, step, text, timerSeconds, temperature })

const CURRY: Recipe = {
  id: 'demo-chicken-curry',
  title: 'Chicken Curry',
  author: 'Amelia Earhart',
  sourceUrl: 'https://www.tiktok.com/@ameliacooks/video/7300000000000000001',
  thumbnailUrl:
    'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1200&q=80',
  servings: 2,
  prepTime: 15,
  cookTime: 30,
  totalTime: 45,
  calories: 425,
  rating: 4,
  difficulty: 'Easy',
  mealTypes: ['dinner'],
  ingredients: [
    ing('chicken breasts', 16, 'oz', 'diced'),
    ing('basmati rice', 1, 'cup'),
    ing('olive oil', 2, 'tbsp'),
    ing('yellow onion', 8, 'oz', 'small-diced'),
    ing('canned tomatoes', 16, 'oz'),
    ing('garlic', 2, 'clove', 'minced'),
    ing('ginger root', 2, 'tbsp', 'minced'),
    ing('curry powder', 6, 'tsp'),
    ing('paprika', 2, 'tsp'),
    ing('coconut milk', 0.5, 'cup', undefined, '1/2'),
    ing('salt', 1, 'tsp'),
    ing('cilantro', undefined, undefined, 'chopped, to finish'),
  ],
  directions: [
    dir(
      1,
      'Heat olive oil in a high-sided medium skillet. Add chicken and cook until browned on all sides.',
      undefined,
      { value: 102, unit: 'F' },
    ),
    dir(
      2,
      'Add two cups of water to a medium sauce pan. Add rice and a pinch of salt. Bring to a boil on high. Once boiling, set temperature to low and cover for 14 minutes.',
      840,
    ),
    dir(
      3,
      'Push the chicken to one side and add the onion, garlic and ginger. Cook for 5 minutes until the onion turns translucent.',
      300,
    ),
    dir(
      4,
      'Stir in the curry powder and paprika and toast for 1 minute so the spices bloom in the oil.',
      60,
    ),
    dir(
      5,
      'Pour in the canned tomatoes and coconut milk. Simmer uncovered for 20 minutes until the sauce thickens and coats the chicken.',
      1200,
    ),
    dir(6, 'Fluff the rice, spoon the curry over the top and finish with chopped cilantro.'),
  ],
  notes:
    'Toasting the spices before adding liquid is what separates this from a flat weeknight curry. Swap the coconut milk for heavy cream for a richer, tikka-style sauce.',
  createdAt: '2026-08-02T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
  favorite: true,
}

const COOKIES: Recipe = {
  id: 'demo-chocolate-chip-cookies',
  title: 'Brown Butter Chocolate Chip Cookies',
  author: 'Marta Vidal',
  sourceUrl: 'https://www.tiktok.com/@martabakes/video/7300000000000000002',
  thumbnailUrl:
    'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80',
  servings: 24,
  prepTime: 20,
  cookTime: 12,
  totalTime: 32,
  calories: 210,
  rating: 5,
  difficulty: 'Medium',
  mealTypes: ['dessert'],
  ingredients: [
    ing('unsalted butter', 1, 'cup'),
    ing('brown sugar', 1, 'cup', 'packed'),
    ing('granulated sugar', 0.5, 'cup', undefined, '1/2'),
    ing('eggs', 2),
    ing('vanilla extract', 2, 'tsp'),
    ing('all-purpose flour', 2.25, 'cup', undefined, '2 1/4'),
    ing('baking soda', 1, 'tsp'),
    ing('salt', 1, 'tsp'),
    ing('dark chocolate', 12, 'oz', 'chopped'),
    ing('flaky sea salt', undefined, undefined, 'for finishing'),
  ],
  directions: [
    dir(
      1,
      'Melt the butter in a light-coloured pan over medium heat and keep swirling until it smells nutty and the milk solids turn amber, about 6 minutes. Pour it into a bowl and cool for 10 minutes.',
      360,
    ),
    dir(2, 'Whisk the brown butter with both sugars until glossy, then beat in the eggs and vanilla.'),
    dir(3, 'Fold in the flour, baking soda and salt until barely combined, then fold through the chopped chocolate.'),
    dir(
      4,
      'Chill the dough for 30 minutes so the cookies spread evenly instead of running thin.',
      1800,
    ),
    dir(
      5,
      'Preheat the oven to 350 degrees and line two sheet pans with parchment.',
      undefined,
      { value: 350, unit: 'F' },
    ),
    dir(
      6,
      'Scoop golf-ball sized rounds, space them well apart and bake for 12 minutes until the edges are set but the centres still look underdone.',
      720,
      { value: 350, unit: 'F' },
    ),
    dir(7, 'Sprinkle with flaky salt and let them finish setting on the tray for 5 minutes.', 300),
  ],
  notes: 'The dough keeps in the fridge for three days and bakes even better on day two.',
  createdAt: '2026-08-11T10:00:00.000Z',
  updatedAt: '2026-08-11T10:00:00.000Z',
  favorite: false,
}

const PASTA: Recipe = {
  id: 'demo-garlic-butter-pasta',
  title: 'Garlic Butter Tomato Pasta',
  author: 'Deniz Kaya',
  sourceUrl: 'https://www.tiktok.com/@denizeats/video/7300000000000000003',
  thumbnailUrl:
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80',
  servings: 4,
  prepTime: 10,
  cookTime: 20,
  totalTime: 30,
  calories: 520,
  rating: 4,
  difficulty: 'Easy',
  mealTypes: ['dinner', 'lunch'],
  ingredients: [
    ing('spaghetti', 12, 'oz'),
    ing('cherry tomatoes', 2, 'cup', 'halved'),
    ing('unsalted butter', 4, 'tbsp'),
    ing('olive oil', 2, 'tbsp'),
    ing('garlic', 6, 'clove', 'thinly sliced'),
    ing('chili flakes', 0.5, 'tsp', undefined, '1/2'),
    ing('parmesan', 1, 'cup', 'grated'),
    ing('basil', 1, 'handful', 'torn'),
    ing('salt', undefined, undefined, 'for the pasta water'),
  ],
  directions: [
    dir(
      1,
      'Bring a large pot of well-salted water to a boil and cook the spaghetti for 9 minutes, one minute short of the packet time.',
      540,
    ),
    dir(
      2,
      'Meanwhile melt the butter with the olive oil over medium-low heat and cook the sliced garlic for 2 minutes until pale gold, never browned.',
      120,
    ),
    dir(3, 'Add the cherry tomatoes and chili flakes and press them with a spoon until they burst and turn saucy.'),
    dir(
      4,
      'Transfer the pasta straight into the pan with a cup of the starchy cooking water and toss hard for 2 minutes until the sauce clings.',
      120,
    ),
    dir(5, 'Kill the heat, fold through the parmesan and basil, and serve immediately.'),
  ],
  notes: 'Reserve more pasta water than you think you need — it is the only thing that emulsifies the sauce.',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  favorite: false,
}

export const DEMO_RECIPE_IDS = [CURRY.id, COOKIES.id, PASTA.id]

/** Fresh deep copies so demo data can be edited like any other recipe. */
export function demoRecipes(): Recipe[] {
  return [CURRY, COOKIES, PASTA].map((recipe) => structuredClone(recipe))
}
