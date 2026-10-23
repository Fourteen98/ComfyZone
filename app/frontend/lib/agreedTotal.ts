// "All of it for GH₵ 300": share one agreed total across the lines of a sale.
//
// Each line keeps its share of the usual total (a GH₵ 200 dress takes twice
// the cut of a GH₵ 100 top), and becomes an agreed price per piece, so stock,
// profit and reports work exactly as for any bargained price (lesson 39).
//
// Prices are whole pesewas per piece, so a total can't always be split
// exactly: 3 pieces for GH₵ 100 is 33.333… each. The pesewas left over are
// added one at a time to the line with the most pieces that still fits, so
// a line of 1 piece always makes the total exact. If no line can take what
// is left (only possible when every line has several pieces), the result is
// the nearest total just under, and `exact` is false.
//
//   splitTotal([{ id: 1, quantity: 2, unit: 10000 }, { id: 2, quantity: 1, unit: 5000 }], 20000)
//   // => { units: { 1: 8000, 2: 4000 }, total: 20000, exact: true }

export type SplitLine = { id: number; quantity: number; unit: number }
export type Split = { units: Record<number, number>; total: number; exact: boolean }

export function splitTotal(lines: SplitLine[], target: number): Split {
  const live = lines.filter((line) => line.quantity > 0)
  const usual = live.reduce((sum, line) => sum + line.quantity * line.unit, 0)
  const pieces = live.reduce((sum, line) => sum + line.quantity, 0)
  const units: Record<number, number> = {}
  if (live.length === 0 || target < 0) return { units, total: 0, exact: target === 0 }

  // Each line's fair share, rounded DOWN to whole pesewas per piece. If the
  // usual total is 0 (all free?), share by pieces instead.
  for (const line of live) {
    const share = usual > 0 ? (target * line.quantity * line.unit) / usual : (target * line.quantity) / pieces
    units[line.id] = Math.floor(share / line.quantity)
  }

  // Hand out what rounding down left over.
  let left = target - live.reduce((sum, line) => sum + line.quantity * units[line.id], 0)
  const biggestFirst = [...live].sort((a, b) => b.quantity - a.quantity)
  while (left > 0) {
    const line = biggestFirst.find((each) => each.quantity <= left)
    if (!line) break
    const steps = Math.floor(left / line.quantity)
    units[line.id] += steps
    left -= steps * line.quantity
  }

  return { units, total: target - left, exact: left === 0 }
}
