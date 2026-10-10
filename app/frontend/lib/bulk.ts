// The bulk price rule, for totals on screen. The same rule as BulkPricing
// in Rails, which works out the real price when the order is saved:
//
//   a product with a bulk price sells at it when the order has `from` or
//   more of THAT product (any size or colour), or the buyer is a bulk buyer.
//   It never raises a price: a size already cheaper keeps its own price.

export type Bulk = { price_pesewas: number; from: number } | null | undefined

export function bulkOn(bulk: Bulk, pieces: number, bulkBuyer: boolean): boolean {
  return !!bulk && (bulkBuyer || pieces >= bulk.from)
}

export function unitPrice(normal: number, bulk: Bulk, on: boolean): number {
  return on && bulk ? Math.min(normal, bulk.price_pesewas) : normal
}

/** "2 more for the bulk price", or null if it's on or doesn't apply. */
export function bulkNudge(bulk: Bulk, pieces: number, bulkBuyer: boolean): string | null {
  if (!bulk || bulkOn(bulk, pieces, bulkBuyer) || pieces === 0) return null
  const short = bulk.from - pieces
  return `${short} more for the bulk price`
}
