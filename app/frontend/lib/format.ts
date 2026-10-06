// Money is stored as whole pesewas (GH₵ 12.50 is 1250) so sums never drift.
// This is the one place that turns pesewas into text for the screen.
export function formatMoney(pesewas: number): string {
  const cedis = (pesewas / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `GH₵ ${cedis}`
}

// What she typed ("120.50") -> pesewas, for live totals on screen only.
// Anything unreadable counts as 0. Rails does the real parsing on save
// (app/models/pesewas.rb); never send a number worked out here as the truth.
export function toPesewas(input: string): number {
  const text = input.replace(/[,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 0
  const [cedis, fraction = ''] = text.split('.')
  // Built from the digits, not multiplied as a float, so 19.99 is 1999 exactly.
  return Number(cedis) * 100 + Number(fraction.padEnd(2, '0'))
}

// Pesewas -> what belongs in a money box: 12050 -> "120.50", 12000 -> "120".
// The twin of Pesewas.to_input in Ruby.
export function toMoneyInput(pesewas: number): string {
  const cedis = Math.floor(pesewas / 100)
  const rest = pesewas % 100
  return rest === 0 ? String(cedis) : `${cedis}.${String(rest).padStart(2, '0')}`
}

export function greeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
