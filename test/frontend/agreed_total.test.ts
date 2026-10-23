// Run with:  npm run test:js
// (Node runs TypeScript directly with --experimental-strip-types.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitTotal } from '../../app/frontend/lib/agreedTotal.ts'

type Line = { id: number; quantity: number; unit: number }
const sum = (lines: Line[], units: Record<number, number>) => lines.reduce((total, line) => total + line.quantity * units[line.id], 0)

test('shares by value: a dress worth twice as much takes twice the cut', () => {
  assert.deepEqual(splitTotal([{ id: 1, quantity: 2, unit: 10000 }, { id: 2, quantity: 1, unit: 5000 }], 20000), {
    units: { 1: 8000, 2: 4000 },
    total: 20000,
    exact: true,
  })
})

test('3 of one item for GH₵ 100 cannot be exact: 33.33 each, 1 pesewa short', () => {
  const split = splitTotal([{ id: 1, quantity: 3, unit: 4000 }], 10000)
  assert.deepEqual([split.units[1], split.total, split.exact], [3333, 9999, false])
})

test('any total, any lines: never over, exact whenever one line is a single piece', () => {
  for (let round = 0; round < 3000; round++) {
    const lines = Array.from({ length: 1 + Math.floor(Math.random() * 5) }, (_, index) => ({
      id: index + 1,
      quantity: 1 + Math.floor(Math.random() * 12),
      unit: Math.floor(Math.random() * 50000),
    }))
    const target = Math.floor(Math.random() * 400000)
    const split = splitTotal(lines, target)
    assert.equal(sum(lines, split.units), split.total)
    assert.ok(split.total <= target)
    if (lines.some((line) => line.quantity === 1)) assert.ok(split.exact)
  }
})
