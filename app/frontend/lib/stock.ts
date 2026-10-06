// Shared wording for stock, so every screen says the same thing.

export type StockLevel = 'ok' | 'low' | 'out'

// Rails stores short codes in stock_movements.reason; these are the words
// she reads. Keep in step with StockMovement::REASONS.
export const reasonLabels: Record<string, string> = {
  purchase: 'Purchase arrived',
  sale: 'Sold',
  return: 'Returned by customer',
  recount: 'Counted',
  damaged: 'Damaged',
  lost: 'Lost or stolen',
  personal: 'Kept or given away',
  found: 'Found more',
}

// The choices on the "correct the count" form.
// Keep in step with StockAdjustment::DIRECTIONS.
export const adjustmentReasons = [
  { value: 'recount', label: 'I counted them', direction: 'set' },
  { value: 'damaged', label: 'Some are damaged', direction: 'out' },
  { value: 'lost', label: 'Some are lost or stolen', direction: 'out' },
  { value: 'personal', label: 'Kept or gave some away', direction: 'out' },
  { value: 'found', label: 'Found more', direction: 'in' },
] as const

export type AdjustmentDirection = (typeof adjustmentReasons)[number]['direction']
