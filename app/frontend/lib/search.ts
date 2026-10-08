// Searching for a particular size and colour by typing, in any order:
//
//   "orange 3xl"   "3xl orange"   "kaftan orange 3xl"   "maxi 3x"
//
// Every word typed must be found somewhere: in the product's name, in one
// of the variant's choices (size, colour, length...) or in its SKU. The
// best match scores highest, so the item she means comes first.
//
// Each typed word is matched against the START of words, so "xl" finds XL
// but not 3XL or XXL, and "m" finds size M (and "maxi") but not "Ama".
// A word that is exactly one of the variant's choices counts most.
//
// The Rails twin is app/models/variant_search.rb (the stock page searches
// on the server). Keep the two in step.

export const searchWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/^@/, '')
    .split(/[\s,/]+/)
    .filter(Boolean)

type Matchable = { productName: string; optionLabels: string[]; sku?: string | null }

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[\s,/()-]+/)
    .filter(Boolean)

/** 0 = not a match. Higher = better. */
export function matchScore(typed: string[], item: Matchable): number {
  if (typed.length === 0) return 1
  const name = wordsOf(item.productName)
  const options = item.optionLabels.flatMap(wordsOf)
  const sku = (item.sku ?? '').toLowerCase()

  let score = 0
  for (const word of typed) {
    if (options.includes(word))
      score += 4 // "3xl" is exactly a size
    else if (name.includes(word))
      score += 3 // "kaftan" is exactly in the name
    else if (options.some((option) => option.startsWith(word))) score += 2
    else if (name.some((part) => part.startsWith(word))) score += 2
    else if (sku && sku.includes(word)) score += 1
    else return 0 // every word must be found somewhere
  }
  return score
}

type SearchableVariant = { option_values: { label: string }[]; sku?: string | null }

/** For one variant of a product. */
export const variantScore = (typed: string[], productName: string, variant: SearchableVariant) =>
  matchScore(typed, { productName, optionLabels: variant.option_values.map((value) => value.label), sku: variant.sku })

/**
 * Products that match, best first. For each: `matches` are the variants that
 * matched (best first), `best` the ones sharing the top score (what the
 * search most likely meant: "orange 3xl" -> just that one).
 * A product matches when any of its variants does.
 */
export function rankProducts<P extends { name: string; variants: SearchableVariant[] }>(
  text: string,
  products: P[],
): { product: P; score: number; matches: P['variants']; best: P['variants'] }[] {
  const typed = searchWords(text)
  return products
    .map((product) => {
      const scored = product.variants
        .map((variant) => ({ variant, score: variantScore(typed, product.name, variant) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
      const top = scored[0]?.score ?? 0
      return {
        product,
        score: top,
        matches: scored.map((entry) => entry.variant) as P['variants'],
        best: scored.filter((entry) => entry.score === top).map((entry) => entry.variant) as P['variants'],
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
}
