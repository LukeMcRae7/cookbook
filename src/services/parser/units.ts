/** Canonical unit vocabulary. Spoken aliases -> the short form we display. */

const UNIT_ALIASES: Record<string, string> = {}

function register(canonical: string, ...aliases: string[]) {
  UNIT_ALIASES[canonical] = canonical
  for (const alias of aliases) UNIT_ALIASES[alias] = canonical
}

register('cup', 'cups', 'c')
register('tbsp', 'tablespoon', 'tablespoons', 'tbs', 'tbsps', 'tblsp', 'T')
register('tsp', 'teaspoon', 'teaspoons', 'tsps', 'tspn')
register('oz', 'ounce', 'ounces', 'ozs')
register('fl oz', 'floz', 'fluid ounce', 'fluid ounces')
register('lb', 'pound', 'pounds', 'lbs')
register('g', 'gram', 'grams', 'gr')
register('kg', 'kilogram', 'kilograms', 'kilo', 'kilos')
register('ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres')
register('l', 'liter', 'liters', 'litre', 'litres')
register('quart', 'quarts', 'qt', 'qts')
register('pint', 'pints', 'pt')
register('gallon', 'gallons', 'gal')
register('pinch', 'pinches')
register('dash', 'dashes')
register('clove', 'cloves')
register('can', 'cans')
register('jar', 'jars')
register('package', 'packages', 'pkg', 'pkgs', 'packet', 'packets')
register('stick', 'sticks')
register('slice', 'slices')
register('handful', 'handfuls')
register('sprig', 'sprigs')
register('bunch', 'bunches')
register('head', 'heads')
register('stalk', 'stalks')
register('piece', 'pieces')
register('scoop', 'scoops')
register('splash', 'splashes')
register('knob', 'knobs')
register('strip', 'strips')
register('sheet', 'sheets')
register('bag', 'bags')
register('box', 'boxes')
register('bottle', 'bottles')
register('carton', 'cartons')
register('tin', 'tins')
register('block', 'blocks')
register('cube', 'cubes')
register('drop', 'drops')

/** Units that read naturally in the plural ("2 cups", "3 cloves"). */
const PLURALISED = new Set([
  'cup', 'quart', 'pint', 'gallon', 'pinch', 'dash', 'clove', 'can', 'jar',
  'package', 'stick', 'slice', 'handful', 'sprig', 'bunch', 'head', 'stalk',
  'piece', 'scoop', 'splash', 'knob', 'strip', 'sheet', 'bag', 'bottle', 'box',
  'carton', 'tin', 'block', 'cube', 'drop',
])

const IRREGULAR_PLURALS: Record<string, string> = {
  pinch: 'pinches',
  dash: 'dashes',
  bunch: 'bunches',
  splash: 'splashes',
  box: 'boxes',
}

export function canonicalUnit(token: string): string | null {
  const key = token.trim().toLowerCase().replace(/[.]/g, '')
  if (!key) return null
  if (key === 'T') return 'tbsp'
  return UNIT_ALIASES[key] ?? UNIT_ALIASES[token.trim()] ?? null
}

export function isUnit(token: string): boolean {
  return canonicalUnit(token) !== null
}

/** Two-word units such as "fluid ounces" — returns tokens consumed. */
export function matchUnit(tokens: string[]): { unit: string; consumed: number } | null {
  if (tokens.length === 0) return null
  if (tokens.length >= 2) {
    const pair = canonicalUnit(`${tokens[0]} ${tokens[1]}`)
    if (pair) return { unit: pair, consumed: 2 }
  }
  const single = canonicalUnit(tokens[0])
  if (single) return { unit: single, consumed: 1 }
  return null
}

export function formatUnit(unit: string | undefined, quantity: number | undefined): string {
  if (!unit) return ''
  if (quantity === undefined || quantity <= 1) return unit
  if (!PLURALISED.has(unit)) return unit
  return IRREGULAR_PLURALS[unit] ?? `${unit}s`
}

export const ALL_UNITS = Array.from(new Set(Object.values(UNIT_ALIASES))).sort()
