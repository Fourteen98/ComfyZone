// The colour grid: ready-made clothing colours to tap instead of hunting in a
// colour picker. Grouped roughly like a rainbow so a colour is easy to find,
// with the neutrals she sells most at the start.
//
// To add or change one, edit this list; every colour grid in the app uses it.
export type PaletteColour = { name: string; hex: string; also?: string[] }

export const PALETTE: PaletteColour[] = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Off-white', hex: '#f5f1e6', also: ['ivory'] },
  { name: 'Cream', hex: '#f0e6cf' },
  { name: 'Beige', hex: '#d9c4a3' },
  { name: 'Nude', hex: '#e3bc9a', also: ['skin', 'tan'] },
  { name: 'Khaki', hex: '#b7a77a' },
  { name: 'Camel', hex: '#c19a6b' },
  { name: 'Brown', hex: '#7b4a2d' },
  { name: 'Chocolate', hex: '#4e2a1e', also: ['coffee', 'dark brown'] },
  { name: 'Grey', hex: '#8c8c8c', also: ['gray'] },
  { name: 'Ash', hex: '#b2b2ad', also: ['light grey', 'light gray'] },
  { name: 'Charcoal', hex: '#3c3f44', also: ['dark grey', 'dark gray'] },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'Gold', hex: '#c9a227' },
  { name: 'Yellow', hex: '#f2d230' },
  { name: 'Mustard', hex: '#d4a017' },
  { name: 'Orange', hex: '#e8772e' },
  { name: 'Rust', hex: '#b5502a', also: ['burnt orange'] },
  { name: 'Peach', hex: '#f6b99b' },
  { name: 'Coral', hex: '#f0715f' },
  { name: 'Red', hex: '#c0262d' },
  { name: 'Wine', hex: '#5e1a2b', also: ['burgundy'] },
  { name: 'Maroon', hex: '#7a1f2b' },
  { name: 'Pink', hex: '#f3a6c0', also: ['baby pink'] },
  { name: 'Hot pink', hex: '#e0367f', also: ['fuchsia', 'magenta'] },
  { name: 'Lilac', hex: '#c8a2c8', also: ['lavender'] },
  { name: 'Purple', hex: '#6b3fa0' },
  { name: 'Navy', hex: '#1f2a4d', also: ['navy blue'] },
  { name: 'Blue', hex: '#2f6fd1', also: ['royal blue'] },
  { name: 'Sky blue', hex: '#8cc7ec', also: ['baby blue', 'light blue'] },
  { name: 'Denim', hex: '#4f6d8f' },
  { name: 'Teal', hex: '#13827f' },
  { name: 'Mint', hex: '#a8e0c4' },
  { name: 'Green', hex: '#2e8b4a' },
  { name: 'Emerald', hex: '#0f7a52' },
  { name: 'Olive', hex: '#6b7a32', also: ['army green', 'olive green'] },
  { name: 'Lime', hex: '#a8cf45' },
]

const byName = new Map<string, string>()
for (const colour of PALETTE) {
  byName.set(colour.name.toLowerCase(), colour.hex)
  for (const other of colour.also ?? []) byName.set(other, colour.hex)
}

// The grid's colour for a name she typed: "mustard" -> "#d4a017",
// "Army green" -> Olive's. null when it isn't one of them.
export function paletteHex(name: string): string | null {
  return byName.get(name.trim().replace(/\s+/g, ' ').toLowerCase()) ?? null
}

// Is this option about colours? ("Colour", "Color", "Colours", "Shade")
export const isColourOption = (name: string) => /colou?rs?|shade/i.test(name)
