// Colours for clothes, in two layers:
//
//  1. The GRID (PALETTE below): about a hundred colours picked by hand for
//     what a clothing shop actually sells, grouped in families so a colour is
//     quick to find by eye. To add or change one, edit this list.
//  2. SEARCH (searchColours / lookupHex): every name in the color-name-list
//     package (about 32,000, MIT licence): "sage", "dusty rose",
//     "terracotta"... It is big (about 300 KB), so it is only downloaded the
//     first time she searches, then kept.
export type PaletteColour = { name: string; hex: string; also?: string[] }
export type ColourFamily = { family: string; colours: PaletteColour[] }

export const FAMILIES: ColourFamily[] = [
  {
    family: 'Whites and neutrals',
    colours: [
      { name: 'White', hex: '#ffffff' },
      { name: 'Off-white', hex: '#f5f1e6', also: ['ivory'] },
      { name: 'Cream', hex: '#f0e6cf' },
      { name: 'Champagne', hex: '#ead7b5' },
      { name: 'Beige', hex: '#d9c4a3' },
      { name: 'Sand', hex: '#cbb08a' },
      { name: 'Nude', hex: '#e3bc9a', also: ['skin'] },
      { name: 'Stone', hex: '#b9ad9b' },
      { name: 'Taupe', hex: '#9b8b7a' },
      { name: 'Khaki', hex: '#b7a77a' },
      { name: 'Oatmeal', hex: '#d8cbb3' },
    ],
  },
  {
    family: 'Greys and blacks',
    colours: [
      { name: 'Silver', hex: '#c0c0c0' },
      { name: 'Ash', hex: '#b2b2ad', also: ['light grey', 'light gray'] },
      { name: 'Grey', hex: '#8c8c8c', also: ['gray'] },
      { name: 'Slate', hex: '#6a7178' },
      { name: 'Charcoal', hex: '#3c3f44', also: ['dark grey', 'dark gray'] },
      { name: 'Jet black', hex: '#0d0d0d' },
      { name: 'Black', hex: '#1a1a1a' },
    ],
  },
  {
    family: 'Browns',
    colours: [
      { name: 'Tan', hex: '#c8a27a' },
      { name: 'Camel', hex: '#c19a6b' },
      { name: 'Caramel', hex: '#af6f32' },
      { name: 'Cinnamon', hex: '#9c5a32' },
      { name: 'Brown', hex: '#7b4a2d' },
      { name: 'Mocha', hex: '#6f4e3d' },
      { name: 'Coffee', hex: '#5b3a29' },
      { name: 'Chocolate', hex: '#4e2a1e', also: ['dark brown'] },
    ],
  },
  {
    family: 'Yellows and golds',
    colours: [
      { name: 'Lemon', hex: '#f7e463' },
      { name: 'Butter', hex: '#f5e3a1', also: ['pastel yellow'] },
      { name: 'Yellow', hex: '#f2d230' },
      { name: 'Sunflower', hex: '#f5b700' },
      { name: 'Mustard', hex: '#d4a017' },
      { name: 'Ochre', hex: '#c58b1c' },
      { name: 'Gold', hex: '#c9a227' },
    ],
  },
  {
    family: 'Oranges',
    colours: [
      { name: 'Peach', hex: '#f6b99b' },
      { name: 'Apricot', hex: '#f3a76c' },
      { name: 'Orange', hex: '#e8772e' },
      { name: 'Tangerine', hex: '#f28500' },
      { name: 'Burnt orange', hex: '#cc5500' },
      { name: 'Rust', hex: '#b5502a' },
      { name: 'Terracotta', hex: '#c46a4a' },
    ],
  },
  {
    family: 'Reds',
    colours: [
      { name: 'Coral', hex: '#f0715f' },
      { name: 'Salmon', hex: '#f08f7f' },
      { name: 'Red', hex: '#c0262d' },
      { name: 'Scarlet', hex: '#e0201b' },
      { name: 'Cherry', hex: '#a51c30' },
      { name: 'Brick', hex: '#9b3b2c', also: ['brick red'] },
      { name: 'Maroon', hex: '#7a1f2b' },
      { name: 'Burgundy', hex: '#6d1a2c' },
      { name: 'Wine', hex: '#5e1a2b' },
    ],
  },
  {
    family: 'Pinks',
    colours: [
      { name: 'Blush', hex: '#f4c2c2' },
      { name: 'Baby pink', hex: '#f8c8d8' },
      { name: 'Pink', hex: '#f3a6c0' },
      { name: 'Dusty rose', hex: '#c48b8f', also: ['dusty pink', 'old rose'] },
      { name: 'Rose', hex: '#d9667f' },
      { name: 'Hot pink', hex: '#e0367f' },
      { name: 'Fuchsia', hex: '#c8217f', also: ['magenta'] },
      { name: 'Mauve', hex: '#a7788a' },
    ],
  },
  {
    family: 'Purples',
    colours: [
      { name: 'Lavender', hex: '#c9b8e8' },
      { name: 'Lilac', hex: '#c8a2c8' },
      { name: 'Orchid', hex: '#b565a7' },
      { name: 'Violet', hex: '#7f4fb5' },
      { name: 'Purple', hex: '#6b3fa0' },
      { name: 'Plum', hex: '#6a2c5e' },
      { name: 'Eggplant', hex: '#45233f', also: ['aubergine'] },
    ],
  },
  {
    family: 'Blues',
    colours: [
      { name: 'Baby blue', hex: '#bcd9f0', also: ['powder blue'] },
      { name: 'Sky blue', hex: '#8cc7ec', also: ['light blue'] },
      { name: 'Turquoise', hex: '#2bb5b8' },
      { name: 'Aqua', hex: '#5fd3d0' },
      { name: 'Cobalt', hex: '#1f4fb4' },
      { name: 'Blue', hex: '#2f6fd1' },
      { name: 'Royal blue', hex: '#2a4bb5' },
      { name: 'Denim', hex: '#4f6d8f', also: ['jeans'] },
      { name: 'Steel blue', hex: '#4682b4' },
      { name: 'Navy', hex: '#1f2a4d', also: ['navy blue'] },
      { name: 'Midnight', hex: '#151c33', also: ['midnight blue'] },
    ],
  },
  {
    family: 'Greens',
    colours: [
      { name: 'Mint', hex: '#a8e0c4' },
      { name: 'Sage', hex: '#9caf88' },
      { name: 'Pistachio', hex: '#b5c99a' },
      { name: 'Lime', hex: '#a8cf45' },
      { name: 'Green', hex: '#2e8b4a' },
      { name: 'Kelly green', hex: '#2c9a3f' },
      { name: 'Emerald', hex: '#0f7a52' },
      { name: 'Teal', hex: '#13827f' },
      { name: 'Olive', hex: '#6b7a32' },
      { name: 'Army green', hex: '#4b5320', also: ['military green'] },
      { name: 'Forest green', hex: '#2c5531' },
      { name: 'Bottle green', hex: '#0b4a32', also: ['dark green'] },
    ],
  },
  {
    family: 'Metallics and prints',
    colours: [
      { name: 'Rose gold', hex: '#b76e79' },
      { name: 'Bronze', hex: '#a2703a' },
      { name: 'Copper', hex: '#b87333' },
      { name: 'Pewter', hex: '#8e9294' },
      { name: 'Leopard', hex: '#c2954a', also: ['animal print'] },
      { name: 'Multicolour', hex: '#b04f8a', also: ['multicolor', 'multi', 'print'] },
    ],
  },
]

// Every grid colour in one list.
export const PALETTE: PaletteColour[] = FAMILIES.flatMap((family) => family.colours)

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

const byName = new Map<string, string>()
for (const colour of PALETTE) {
  byName.set(tidy(colour.name), colour.hex)
  for (const other of colour.also ?? []) byName.set(other, colour.hex)
}

// The grid's colour for a name she typed: "mustard" -> "#d4a017",
// "Military green" -> Army green's. null when the grid doesn't have it.
export function paletteHex(name: string): string | null {
  return byName.get(tidy(name)) ?? null
}

// Is this option about colours? ("Colour", "Color", "Colours", "Shade")
export const isColourOption = (name: string) => /colou?rs?|shade/i.test(name)

// ---- the big list --------------------------------------------------------

type Named = { name: string; hex: string }
let everything: Promise<Named[]> | null = null

// import() with a variable-free path: Vite puts the list in its own file,
// fetched the first time this runs and cached by the browser after that.
function loadEverything(): Promise<Named[]> {
  everything ??= import('color-name-list')
    .then((module) => module.colornames)
    .catch((error) => {
      everything = null // a dropped connection: try again next time
      throw error
    })
  return everything
}

// Colours whose name matches what she typed, best first: the grid's own,
// then exact names, then names starting with it, then names containing it;
// shorter (plainer) names before long fancy ones. At most `limit`.
export async function searchColours(typed: string, limit = 24): Promise<Named[]> {
  const term = tidy(typed)
  if (term.length < 2) return []

  const mine = PALETTE.filter((colour) => [colour.name, ...(colour.also ?? [])].some((name) => tidy(name).includes(term))).map(
    ({ name, hex }) => ({ name, hex }),
  )
  const all = await loadEverything()
  const rank = (name: string) => {
    const lower = name.toLowerCase()
    if (lower === term) return 0
    if (lower.startsWith(term)) return 1
    if (lower.split(/[\s-]/).some((word) => word.startsWith(term))) return 2
    return lower.includes(term) ? 3 : -1
  }
  const found = all
    .map((colour) => ({ colour, score: rank(colour.name) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.colour.name.length - b.colour.name.length)
    .map((entry) => entry.colour)

  const seen = new Set(mine.map((colour) => colour.name.toLowerCase()))
  return [...mine, ...found.filter((colour) => !seen.has(colour.name.toLowerCase()))].slice(0, limit)
}

// The colour for a typed name, from the grid or else the big list. Used to
// give "terracotta" or "sage" its colour when it's typed, not picked.
export async function lookupHex(name: string): Promise<string | null> {
  const mine = paletteHex(name)
  if (mine) return mine
  if (tidy(name).length < 3) return null
  try {
    const all = await loadEverything()
    const term = tidy(name)
    return all.find((colour) => colour.name.toLowerCase() === term)?.hex ?? null
  } catch {
    return null // offline: it just stays grey, to be picked by hand
  }
}
