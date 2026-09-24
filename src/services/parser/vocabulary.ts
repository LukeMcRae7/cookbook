/** Shared word lists. Kept in one place so the parsers stay readable. */

/** Verbs that introduce an instruction step. */
export const COOKING_VERBS = new Set([
  'add', 'bake', 'baste', 'beat', 'blend', 'blanch', 'boil',
  'braise', 'bring', 'broil', 'brown', 'brush', 'chill', 'chop', 'coat',
  'combine', 'cook', 'cool', 'cover', 'crack', 'cream', 'crush', 'cut',
  'deglaze', 'dice', 'dip', 'drain', 'drizzle', 'dust', 'fill', 'finish',
  'flip', 'fold', 'fry', 'garnish', 'glaze', 'grate', 'grease', 'grill',
  'heat', 'knead', 'layer', 'let', 'marinate', 'mash', 'melt', 'microwave',
  'mince', 'mix', 'peel', 'place', 'plate', 'poach', 'pour',
  'preheat', 'press', 'puree', 'put', 'reduce', 'refrigerate', 'remove',
  'repeat', 'rest', 'return', 'rinse', 'roast', 'roll', 'saute', 'sauté',
  'scoop', 'scramble', 'sear', 'season', 'separate', 'serve', 'set', 'shake',
  'simmer', 'slice', 'soak', 'spoon', 'spread', 'sprinkle', 'squeeze',
  'steam', 'stir', 'strain', 'stuff', 'swirl', 'take', 'tear', 'toast',
  'top', 'toss', 'transfer', 'turn', 'wait', 'wash', 'whip', 'whisk', 'wrap',
  // Common on recipe sites. Words that more often open an ingredient line
  // ("Zest of 1 lemon", "Bread, 2 slices") are deliberately left out.
  'allow', 'arrange', 'assemble', 'char', 'check', 'core', 'crumble', 'cube',
  'discard', 'divide', 'dollop', 'dredge', 'dry', 'fluff', 'form', 'freeze',
  'halve', 'keep', 'lay', 'leave', 'line', 'massage', 'measure', 'pat', 'prep', 'prepare',
  'pipe', 'portion', 'process', 'pulse', 'reheat', 'reserve', 'rub', 'score',
  'shape', 'shred', 'sieve', 'sift', 'skewer', 'smoke', 'store', 'taste',
  'thaw', 'thread', 'trim', 'tuck', 'uncover', 'use', 'warm',
])

/**
 * Verbs whose object is almost always an ingredient list. Written as one
 * pattern so an interjected adverb ("you'll *also* need") still matches.
 */
export const ADD_VERB_PATTERN =
  /^(?:(?:you(?:'ll| will)?|we(?:'ll| will)?|i)\s+(?:also\s+|then\s+|just\s+)*(?:need|want|use|grab)|start\s+with|begin\s+with|grab|add(?:\s+in)?|mix\s+in|stir\s+in|pour\s+in|throw\s+in|toss\s+in|drop\s+in|put\s+in|sprinkle\s+in|fold\s+in|combine|whisk\s+together|mix\s+together|take)\s+/i

/** Words that describe how an ingredient was prepared. */
export const PREP_WORDS = new Set([
  'beaten', 'boiled', 'chilled', 'chopped', 'cooked', 'cored', 'crumbled',
  'crushed', 'cubed', 'diced', 'divided', 'drained', 'grated', 'halved',
  'julienned', 'mashed', 'melted', 'minced', 'packed', 'peeled', 'pitted',
  'quartered', 'rinsed', 'roasted', 'seeded', 'shredded', 'sifted', 'sliced',
  'smashed', 'softened', 'squeezed', 'stemmed', 'thawed', 'toasted',
  'trimmed', 'warmed', 'whipped', 'zested', 'small-diced', 'large-diced',
  'room-temperature', 'julienne',
])

/** Adverbs that modify a prep word: "finely chopped". */
export const PREP_ADVERBS = new Set([
  'finely', 'roughly', 'coarsely', 'thinly', 'thickly', 'freshly', 'lightly',
  'well', 'evenly', 'small', 'large', 'medium',
])

/** Prep words safe to lift from the front of a phrase ("minced garlic"). */
export const LEADING_PREP_WORDS = new Set([
  'beaten', 'chopped', 'crumbled', 'crushed', 'cubed', 'diced', 'drained',
  'grated', 'halved', 'julienned', 'mashed', 'melted', 'minced', 'peeled',
  'quartered', 'rinsed', 'shredded', 'sifted', 'sliced', 'smashed',
  'softened', 'thawed', 'toasted', 'whipped',
])

/** Hedges and filler that carry no recipe information. */
export const HEDGE_WORDS = new Set([
  'about', 'approximately', 'around', 'roughly', 'like', 'maybe', 'just',
  'literally', 'basically', 'honestly', 'really', 'probably',
])

/** Words that can never be an ingredient name on their own. */
export const NON_INGREDIENT_WORDS = new Set([
  'everything', 'it', 'them', 'this', 'that', 'those', 'these', 'all',
  'rest', 'mixture', 'dough', 'batter', 'pan', 'pot', 'bowl', 'skillet',
  'oven', 'stove', 'heat', 'side', 'sides', 'top', 'bottom', 'minutes',
  'minute', 'hours', 'hour', 'seconds', 'second', 'temperature', 'degrees',
  'time', 'times', 'more', 'lot', 'bit', 'while', 'way', 'guys',
  'video', 'recipe', 'channel', 'comments', 'part', 'thing', 'things',
  'everybody', 'everyone', 'something', 'anything', 'nothing', 'one',
  // Nutrition and metadata lines that sit next to ingredient lists
  'calories', 'kcal', 'cal', 'protein', 'carbs', 'carbohydrates', 'servings',
  'serving', 'yield', 'prep', 'cook', 'total', 'optional', 'thanks', 'thank',
])

/** A generous list of foods so unquantified mentions still register. */
export const FOOD_KEYWORDS = new Set([
  'flour', 'sugar', 'salt', 'pepper', 'butter', 'egg', 'eggs', 'milk',
  'water', 'oil', 'garlic', 'onion', 'onions', 'tomato', 'tomatoes',
  'chicken', 'beef', 'pork', 'lamb', 'shrimp', 'fish', 'salmon', 'tuna',
  'rice', 'pasta', 'spaghetti', 'noodles', 'bread', 'cheese', 'parmesan',
  'mozzarella', 'cheddar', 'cream', 'yogurt', 'honey', 'vanilla', 'cinnamon',
  'paprika', 'cumin', 'turmeric', 'ginger', 'chili', 'chilli', 'basil',
  'parsley', 'cilantro', 'coriander', 'thyme', 'rosemary', 'oregano',
  'lemon', 'lime', 'orange', 'apple', 'banana', 'berries', 'strawberries',
  'blueberries', 'chocolate', 'cocoa', 'soda', 'powder', 'yeast',
  'stock', 'broth', 'wine', 'vinegar', 'soy', 'sauce', 'ketchup', 'mustard',
  'mayo', 'mayonnaise', 'potato', 'potatoes', 'carrot', 'carrots', 'celery',
  'mushroom', 'mushrooms', 'spinach', 'kale', 'lettuce', 'cucumber',
  'zucchini', 'broccoli', 'cauliflower', 'peas', 'beans', 'lentils',
  'chickpeas', 'corn', 'avocado', 'nuts', 'almonds', 'walnuts', 'pecans',
  'peanut', 'sesame', 'olive', 'olives', 'coconut', 'curry', 'masala',
  'cardamom', 'nutmeg', 'bay', 'scallion', 'scallions', 'shallot',
  'shallots', 'leek', 'leeks', 'buttermilk', 'sourdough', 'tofu', 'tempeh',
  'bacon', 'sausage', 'ham', 'steak', 'breadcrumbs', 'cornstarch',
  'gelatin', 'syrup', 'molasses', 'jam', 'peanuts', 'raisins', 'dates',
  'oats', 'quinoa', 'couscous', 'tortilla', 'tortillas', 'naan', 'pita',
  'sprinkles', 'frosting', 'icing', 'zest', 'juice', 'paste', 'seeds',
  'breast', 'breasts', 'thigh', 'thighs', 'wings', 'ribs', 'chives',
  'cardamon', 'saffron', 'anchovy', 'anchovies', 'capers', 'pesto',
  'cabbage', 'pumpkin', 'squash', 'eggplant', 'aubergine', 'pineapple',
  'mango', 'cherries', 'cranberries', 'pear', 'peach', 'plum',
])

/** Sentences containing these are chatter, not cooking. */
export const NOISE_PATTERNS: RegExp[] = [
  /\b(like|follow|subscribe|comment)\s+(and|for|if|to)\b/i,
  /\bfollow\s+me\b/i,
  /\bwelcome\s+back\b/i,
  /\bhey\s+(guys|everyone|y'?all)\b/i,
  /\bwhat'?s\s+up\s+(guys|everyone)\b/i,
  /\blink\s+in\s+(my\s+)?bio\b/i,
  /\bsave\s+this\s+(one|recipe|for)\b/i,
  /\btrust\s+me\b/i,
  /\byou'?re\s+going\s+to\s+love\b/i,
  // Sign-offs: "Enjoy!", "Enjoy your meal prep!", "Bon appétit"
  /^\s*(?:enjoy|bon\s+app[eé]tit|happy\s+(?:cooking|baking))\b.{0,24}$/i,
  /^\s*(okay|ok|alright|so|and|now|anyway)\s*[.!?]?\s*$/i,
]

/** Multi-word food phrases we never want to split on "and". */
export const COMPOUND_FOODS = [
  'salt and pepper',
  'oil and vinegar',
  'cream and sugar',
  'milk and cream',
  'butter and flour',
  'peanut butter and jelly',
]
