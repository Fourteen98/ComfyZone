import { Head, Link, router, usePage } from '@inertiajs/react'
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Lightbulb,
  RotateCcw,
  Search,
  Shirt,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import StockLevelBadge from '@/components/StockLevelBadge'
import StockAdjustForm from '@/components/StockAdjustForm'
import StockGrid, { constantOptions } from '@/components/StockGrid'
import type { GridSelection } from '@/components/StockGrid'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { confirmAction } from '@/lib/confirm'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import type { StockLevel } from '@/lib/stock'

type VariantRow = {
  id: number
  name: string
  option_values: (OptionValue & { name: string })[]
  stock: number
  level: StockLevel
  value_pesewas: number | null // null = may not see costs
  no_cost: boolean // in stock, but the app was never told what it cost
}

type Group = {
  id: number
  name: string
  low_stock_at: number
  thumb_url: string | null
  sells_for_pesewas: number // these pieces, at their selling prices
  pooled: boolean // counted as one total, not by size (StockPool)
  total: number // that total
  variants: VariantRow[]
}

// If everything on hand sells (StockLedger.sales_estimate). Profits are null
// for people who may not see costs; bulk is null when no stock has a lower bulk price.
type Estimate = {
  sells_for_pesewas: number
  profit_pesewas: number | null
  bulk: { sells_for_pesewas: number; profit_pesewas: number | null } | null
}

type Props = {
  groups: Group[]
  filters: { show: 'all' | 'low' | 'out' | 'uncosted'; q: string }
  // uncosted: null = may not see costs
  counts: { all: number; low: number; out: number; uncosted: number | null }
  totals: { units: number; value_pesewas: number | null }
  estimate: Estimate
  /** While searching: the best match, whose quick form opens by itself. */
  focus_id: number | null
  /** The latest reset, while it can be undone. null = none, or may not adjust stock. */
  last_reset: { batch: string; items: number; note: string; at: string; by: string | null } | null
  /** What to type before a full reset (StockReset::CONFIRM_WORD). */
  confirm_word: string
}

// Props from StockController#index
export default function StockIndex({ groups, filters, counts, totals, estimate, focus_id, last_reset, confirm_word }: Props) {
  const can = useCan()

  // "Reset counts": tap items to choose them instead of opening them, then
  // set them all to 0 (or another number) in one go. See StockReset.
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [resetTo, setResetTo] = useState('0')
  const [fullReset, setFullReset] = useState(false)
  const pickedSet = new Set(picked)
  // Several ids at once (a row, a column, a whole product): all chosen
  // already means un-choose them; otherwise choose them all.
  const toggleIds = (ids: number[]) =>
    setPicked((now) => (ids.every((id) => now.includes(id)) ? now.filter((id) => !ids.includes(id)) : [...new Set([...now, ...ids])]))
  const selection: GridSelection = { picked: pickedSet, toggle: toggleIds }
  const stopSelecting = () => {
    setSelecting(false)
    setPicked([])
    setResetTo('0')
  }

  // What is chosen, in her words: a product counted as one total is one thing.
  const chosen = groups.reduce(
    (sum, group) => {
      const mine = group.variants.filter((variant) => pickedSet.has(variant.id))
      if (mine.length === 0) return sum
      if (group.pooled) return { items: sum.items + 1, pieces: sum.pieces + Math.max(group.total, 0) }
      return { items: sum.items + mine.length, pieces: sum.pieces + mine.reduce((total, variant) => total + Math.max(variant.stock, 0), 0) }
    },
    { items: 0, pieces: 0 },
  )

  async function resetChosen() {
    const to = resetTo === '' ? '0' : resetTo
    const what = chosen.items === 1 ? '1 item' : `${chosen.items} items`
    const sure = await confirmAction(
      `Set ${what} to ${to}? Each one's history keeps the old number, and you can undo this from the top of the Stock page for a day.`,
      { confirm: `Set to ${to}`, danger: to === '0' },
    )
    if (!sure) return
    // -> Stock::ResetsController#create
    // Not preserving the scroll: the page goes back to the top, where the
    // result and its Undo button are.
    router.post('/admin/stock/reset', { variant_ids: picked, to }, { onSuccess: stopSelecting })
  }
  const [query, setQuery] = useState(filters.q)
  const errors = usePage().props.errors as Record<string, string[] | undefined>

  // Type "orange 3xl" and that item comes first with its "update stock"
  // form already open: find it, type the number, done. Other rows open
  // theirs with the Adjust button. A failed save comes back open.
  const searching = filters.q !== '' && can('stock.adjust')
  const [openId, setOpenId] = useState<number | null>(searching ? Number(errors.adjusting?.[0]) || focus_id : null)
  useEffect(() => {
    if (searching) setOpenId(Number(errors.adjusting?.[0]) || focus_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus_id, filters.q])

  // "Everything", not searching: each product is a folded card that opens
  // into a size × colour grid. Searching or a filter (low, out, no cost)
  // already gives a short list, so those show rows with the quick form.
  const gridMode = filters.show === 'all' && filters.q === ''
  // Which cards are open. Remembered on this phone between visits; with only
  // a couple of products, they start open.
  const [open, setOpen] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('stock.open') ?? 'null')
      if (Array.isArray(saved)) return saved
    } catch {
      // private window or blocked storage: start folded
    }
    return groups.length <= 2 ? groups.map((group) => group.id) : []
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('stock.open', JSON.stringify(open))
    } catch {
      // nothing to do: it just won't be remembered
    }
  }, [open])
  const toggle = (id: number) => setOpen(open.includes(id) ? open.filter((other) => other !== id) : [...open, id])
  const allOpen = groups.length > 0 && groups.every((group) => open.includes(group.id))

  const params = (show: string, q = filters.q) => ({ show: show === 'all' ? undefined : show, q: q || undefined })

  // Search as she types, after a short pause. See Products/Index for notes.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      router.get('/admin/stock', params(filters.show, query), { preserveState: true, replace: true })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const tabs = [
    { key: 'all', label: 'Everything', count: counts.all },
    { key: 'low', label: 'Running low', count: counts.low },
    { key: 'out', label: 'Out of stock', count: counts.out },
    // Only there while something needs a cost; it disappears once all are set.
    ...(counts.uncosted ? [{ key: 'uncosted', label: 'No cost yet', count: counts.uncosted }] : []),
  ]

  const stats = [
    { label: 'Items on hand', value: totals.units.toLocaleString() },
    ...(totals.value_pesewas !== null ? [{ label: 'What it cost you', value: formatMoney(totals.value_pesewas) }] : []),
    { label: 'Running low', value: String(counts.low) },
    { label: 'Out of stock', value: String(counts.out) },
  ]

  return (
    <AppLayout>
      <Head title="Stock" />
      <PageHeader
        title="Stock"
        description="What you have on hand right now. Tap any item to see its history or correct its count."
        actions={
          <>
            {can('stock.adjust') && counts.all > 0 && (
              <Button
                type="button"
                variant={selecting ? 'primary' : 'secondary'}
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              >
                {selecting ? <Check className="size-5" aria-hidden="true" /> : <RotateCcw className="size-5" aria-hidden="true" />}
                {selecting ? 'Done choosing' : 'Reset counts'}
              </Button>
            )}
            <ButtonLink href="/admin/stock/advice" variant="secondary">
              <Lightbulb className="size-5" aria-hidden="true" />
              What to buy next
            </ButtonLink>
            {can('stock.adjust') && counts.all > 0 && (
              <ButtonLink href="/admin/stock/count" variant="secondary">
                <ClipboardList className="size-5" aria-hidden="true" />
                Stock take
              </ButtonLink>
            )}
          </>
        }
      />

      {counts.all === 0 && !filters.q ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Boxes} title="Nothing to count yet">
            Add products, then record a purchase. Stock appears here when the goods arrive.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* The latest reset can be taken back for a day. */}
          {last_reset && !selecting && (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-taupe-200 bg-white px-4 py-3">
              <RotateCcw className="size-5 shrink-0 text-taupe-500" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-taupe-800">
                {last_reset.note === 'Full reset' ? 'Full reset' : last_reset.note}: {last_reset.items}{' '}
                {last_reset.items === 1 ? 'item' : 'items'}, {last_reset.at}
                {last_reset.by && ` by ${last_reset.by}`}.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const sure = await confirmAction(
                    `Undo this reset? Every count it changed goes back by the same amount. Sales made since are kept.`,
                    { confirm: 'Undo reset' },
                  )
                  if (sure) router.delete(`/admin/stock/reset/${last_reset.batch}`) // -> Stock::ResetsController#destroy
                }}
              >
                <Undo2 className="size-5" aria-hidden="true" />
                Undo
              </Button>
            </div>
          )}

          {/* Choosing what to reset: how it works, and the big red button. */}
          {selecting && (
            <div className="mt-6 rounded-lg border border-wine-200 bg-wine-50 px-4 py-3">
              <p className="text-wine-800">
                <strong>Tap the items to reset.</strong> Tap a colour or size heading to choose its whole row or column, or "Choose all" on
                a product. Then pick the number at the bottom.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <button
                  type="button"
                  onClick={() => setOpen(groups.map((group) => group.id))}
                  className="min-h-10 font-medium text-wine-800 hover:underline"
                >
                  Open every product
                </button>
                <button type="button" onClick={() => setFullReset(true)} className="min-h-10 font-medium text-red-800 hover:underline">
                  Full reset: everything to 0…
                </button>
              </div>
            </div>
          )}

          <div className="mt-6">
            <StatStrip stats={stats} />
          </div>

          {estimate.sells_for_pesewas > 0 && (
            <EstimateCard estimate={estimate} costsOf={totals.value_pesewas} uncosted={counts.uncosted ?? 0} />
          )}

          {/* Why "What it cost you" may look too low, and where to fix it. */}
          {counts.uncosted ? (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
              {counts.uncosted === 1 ? '1 item is' : `${counts.uncosted} items are`} in stock with no cost recorded, so{' '}
              {counts.uncosted === 1 ? 'it counts' : 'they count'} as GH₵ 0 in "What it cost you" and in profit.{' '}
              <Link href="/admin/stock" data={params('uncosted')} className="font-medium underline underline-offset-4">
                Show {counts.uncosted === 1 ? 'it' : 'them'}
              </Link>
              , then open each one to say what it cost.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-taupe-200">
            <nav aria-label="Show" className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const active = filters.show === tab.key
                return (
                  <Link
                    key={tab.key}
                    href="/admin/stock"
                    data={params(tab.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 font-medium ${
                      active
                        ? 'border-wine-800 text-wine-800'
                        : 'border-transparent text-taupe-700 hover:border-taupe-300 hover:text-wine-800'
                    }`}
                  >
                    {tab.label}
                    <span className="text-sm font-normal tabular-nums opacity-70">{tab.count}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="relative mb-2 w-full sm:w-72">
              <Search className="pointer-events-none absolute top-3 left-3 size-5 text-taupe-500" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search stock"
                placeholder="Product, size or colour: orange 3xl"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block min-h-11 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
              />
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">
              {filters.q
                ? `Nothing matches "${filters.q}".`
                : filters.show === 'low'
                  ? 'Nothing is running low.'
                  : 'Nothing is out of stock.'}
            </p>
          ) : (
            <>
              {gridMode && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(allOpen ? [] : groups.map((group) => group.id))}
                    className="min-h-10 rounded-md px-3 text-sm font-medium text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
                  >
                    {allOpen ? 'Fold all' : 'Open all'}
                  </button>
                </div>
              )}
              {/* Two columns of cards on wide screens (they flow down each column, so
                  a tall open card leaves no gap beside it), one on phones. */}
              <div className={`${gridMode ? 'mt-2' : 'mt-5'} gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid`}>
                {groups.map((group) => {
                  const isOpen = !gridMode || open.includes(group.id)
                  // Counted as one total: one number, one level for the whole product.
                  const here = group.pooled ? group.total : group.variants.reduce((sum, variant) => sum + Math.max(variant.stock, 0), 0)
                  const level = group.variants[0]?.level
                  const low = group.pooled ? Number(level === 'low') : group.variants.filter((variant) => variant.level === 'low').length
                  const out = group.pooled ? Number(level === 'out') : group.variants.filter((variant) => variant.level === 'out').length
                  // "One size", "Maxi": the same for every item, so said once in the header.
                  // Only in the grid: a search's few matches would all look "the same".
                  const same = gridMode ? constantOptions(group.variants) : []
                  return (
                    <section
                      key={group.id}
                      className={`overflow-hidden rounded-lg border bg-white ${
                        selecting && group.variants.some((variant) => pickedSet.has(variant.id)) ? 'border-wine-700' : 'border-taupe-200'
                      }`}
                    >
                      <div className="flex items-stretch">
                        {/* The whole header folds and unfolds the card. */}
                        <button
                          type="button"
                          onClick={() => gridMode && toggle(group.id)}
                          aria-expanded={gridMode ? isOpen : undefined}
                          disabled={!gridMode}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left enabled:hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                        >
                          <span className="flex aspect-[4/5] w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-taupe-200 text-taupe-500">
                            {group.thumb_url ? (
                              <img src={group.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                            ) : (
                              <Shirt className="size-5" aria-hidden="true" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-xl font-semibold text-wine-800 sm:text-2xl">
                              {group.name}
                            </span>
                            <span className="block text-sm text-taupe-700 tabular-nums">
                              {here} here
                              {group.sells_for_pesewas > 0 && `, sells for ${formatMoney(group.sells_for_pesewas)}`}
                              {same.length > 0 && <span className="text-taupe-500"> · {same.join(', ')}</span>}
                            </span>
                            {(group.pooled || (gridMode && (low > 0 || out > 0))) && (
                              <span className="mt-1 flex flex-wrap gap-1.5 text-xs font-medium">
                                {group.pooled && <span className="rounded-full bg-wine-50 px-2 py-0.5 text-wine-800">One total</span>}
                                {low > 0 && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-950">
                                    {group.pooled ? 'Low' : `${low} low`}
                                  </span>
                                )}
                                {out > 0 && (
                                  <span className="rounded-full bg-taupe-100 px-2 py-0.5 text-taupe-700">
                                    {group.pooled ? 'Out' : `${out} out`}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                          {gridMode && (
                            <ChevronDown
                              className={`size-5 shrink-0 text-taupe-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                        {/* Every size and colour of this product, in one tap. */}
                        {selecting && <PickAll name={group.name} ids={group.variants.map((variant) => variant.id)} selection={selection} />}
                      </div>

                      {/* Counted as one total: one number, in every view. */}
                      {group.pooled && isOpen && <PooledBody group={group} canAdjust={can('stock.adjust') && !selecting} />}

                      {!group.pooled && isOpen && gridMode && (
                        <div className="border-t border-taupe-200">
                          <StockGrid variants={group.variants} selection={selecting ? selection : undefined} />
                          {!selecting && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-taupe-100 px-4 py-2 text-sm text-taupe-600">
                              <span>Tap a number to see its history or correct it.</span>
                              <Link href={`/admin/products/${group.id}`} className="font-medium text-wine-800 hover:underline">
                                Product page
                              </Link>
                              {/* Sizes miscounted, but the total is right? Count it as one. */}
                              {can('stock.adjust') && group.variants.length > 1 && (
                                <PoolForm group={group} start={here} label="Sizes don't add up? Count as one total" />
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {!group.pooled && !gridMode && (
                        <ul className="divide-y divide-taupe-200 border-t border-taupe-200">
                          {group.variants.map((variant) => (
                            <li key={variant.id} className={variant.id === openId ? 'bg-wine-50/60' : ''}>
                              {selecting ? (
                                // Choosing: the whole row is one big tick box.
                                <button
                                  type="button"
                                  onClick={() => toggleIds([variant.id])}
                                  aria-pressed={pickedSet.has(variant.id)}
                                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700 ${
                                    pickedSet.has(variant.id) ? 'bg-wine-50' : 'hover:bg-taupe-50'
                                  }`}
                                >
                                  <Tick on={pickedSet.has(variant.id)} />
                                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                    {variant.option_values.length === 0 ? (
                                      <span className="text-taupe-700">One item</span>
                                    ) : (
                                      variant.option_values.map((value) => (
                                        <Chip key={value.name} label={value.label} swatch={value.swatch} />
                                      ))
                                    )}
                                  </span>
                                  <span className="w-10 text-right text-xl font-semibold tabular-nums">{variant.stock}</span>
                                </button>
                              ) : (
                                <div className="flex items-stretch">
                                  <Link
                                    href={`/admin/stock/${variant.id}`}
                                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                                  >
                                    <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                      {variant.option_values.length === 0 ? (
                                        <span className="text-taupe-700">One item</span>
                                      ) : (
                                        // Options every size shares ("One size") are said once, in the header.
                                        variant.option_values
                                          .filter((value) => !same.includes(value.label))
                                          .map((value) => <Chip key={value.name} label={value.label} swatch={value.swatch} />)
                                      )}
                                    </span>
                                    <StockLevelBadge level={variant.level} />
                                    {variant.value_pesewas !== null && variant.stock > 0 && (
                                      <span className="hidden w-28 text-right text-sm text-taupe-700 tabular-nums sm:block">
                                        {variant.no_cost ? 'No cost yet' : formatMoney(variant.value_pesewas)}
                                      </span>
                                    )}
                                    <span
                                      className={`w-10 text-right text-xl font-semibold tabular-nums ${
                                        variant.level === 'out' ? 'text-taupe-400' : 'text-ink'
                                      }`}
                                    >
                                      {variant.stock}
                                    </span>
                                    <ChevronRight className="size-5 shrink-0 text-taupe-400" aria-hidden="true" />
                                  </Link>
                                  {searching && (
                                    <button
                                      type="button"
                                      onClick={() => setOpenId(openId === variant.id ? null : variant.id)}
                                      aria-expanded={openId === variant.id}
                                      aria-label={`Adjust stock for ${group.name}, ${variant.name}`}
                                      className="flex w-14 shrink-0 items-center justify-center border-l border-taupe-200 text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                                    >
                                      <SlidersHorizontal className="size-5" aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {searching && !selecting && openId === variant.id && (
                                <div className="border-t border-taupe-200 px-4 py-4">
                                  {/* Starts on "Found more" (adding); she can switch to counting or taking off. */}
                                  <StockAdjustForm
                                    key={variant.id}
                                    variant={variant}
                                    reason="found"
                                    back={{ q: filters.q, show: filters.show }}
                                    idPrefix={`v${variant.id}_`}
                                  />
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* What's chosen, and what to set it to. Sits above the phone's bottom
          bar; on a computer, stuck to the bottom of the page. */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-taupe-200 bg-white px-4 py-2.5 shadow-[0_-4px_16px_rgb(42_31_29/0.12)] lg:sticky lg:bottom-4 lg:mt-6 lg:rounded-lg lg:border lg:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 tabular-nums">
              {chosen.items === 0 ? (
                <span className="text-taupe-700">Nothing chosen yet</span>
              ) : (
                <>
                  <strong>{chosen.items === 1 ? '1 item' : `${chosen.items} items`}</strong>
                  <button
                    type="button"
                    onClick={() => setPicked([])}
                    className="ml-3 min-h-10 text-sm font-medium text-wine-800 hover:underline"
                  >
                    Clear
                  </button>
                  <span className="block text-sm text-taupe-700 sm:ml-2 sm:inline">
                    {chosen.pieces} {chosen.pieces === 1 ? 'piece' : 'pieces'} now
                  </span>
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="reset_to" className="text-sm font-medium text-taupe-800">
                Set to
              </label>
              <input
                id="reset_to"
                inputMode="numeric"
                value={resetTo}
                onChange={(e) => setResetTo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onFocus={(e) => e.target.select()}
                className="block min-h-11 w-16 rounded-md border-taupe-300 bg-white text-center text-base tabular-nums focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
              />
              <Button
                type="button"
                variant={resetTo === '0' || resetTo === '' ? 'danger' : 'primary'}
                disabled={chosen.items === 0}
                onClick={resetChosen}
              >
                {resetTo === '0' || resetTo === '' ? 'Reset to 0' : 'Set counts'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {fullReset && (
        <FullResetDialog
          word={confirm_word}
          units={totals.units}
          onClose={() => setFullReset(false)}
          onDone={() => {
            setFullReset(false)
            stopSelecting()
          }}
        />
      )}
    </AppLayout>
  )
}

// "Choose all" on a product's header: every size and colour it has.
function PickAll({ name, ids, selection }: { name: string; ids: number[]; selection: GridSelection }) {
  const all = ids.length > 0 && ids.every((id) => selection.picked.has(id))
  return (
    <button
      type="button"
      onClick={() => selection.toggle(ids)}
      aria-pressed={all}
      aria-label={`Choose all of ${name}`}
      className={`flex shrink-0 items-center gap-2 border-l px-3 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700 ${
        all ? 'border-wine-800 bg-wine-800 text-white' : 'border-taupe-200 text-wine-800 hover:bg-taupe-100'
      }`}
    >
      <Tick on={all} light={all} />
      <span className="hidden sm:inline">Choose all</span>
      <span className="sm:hidden">All</span>
    </button>
  )
}

// A tick box drawn to match the buttons it sits in (the button is the control).
function Tick({ on, light = false }: { on: boolean; light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded border-2 ${
        on ? (light ? 'border-white bg-white text-wine-800' : 'border-wine-800 bg-wine-800 text-white') : 'border-taupe-400 bg-white'
      }`}
    >
      {on && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  )
}

// Everything to 0, for starting again from a fresh count. She must type the
// word: a tap can be a slip, typing a word can't. Still undoable for a day.
function FullResetDialog({ word, units, onClose, onDone }: { word: string; units: number; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState('')
  const [saving, setSaving] = useState(false)
  const ready = typed.trim().toUpperCase() === word

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="full_reset_title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="full_reset_title" className="font-display text-2xl font-semibold text-wine-800">
          Reset all stock to zero?
        </h2>
        <p className="mt-2 text-taupe-800">
          Every size and colour of every product goes to 0 ({units.toLocaleString()} {units === 1 ? 'piece' : 'pieces'} on hand now). Do
          this only to start again from a fresh count. The old numbers stay in each item's history, and you can undo it for a day.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!ready) return
            setSaving(true)
            // -> Stock::ResetsController#create
            router.post('/admin/stock/reset', { everything: true, confirm: typed }, { onSuccess: onDone, onFinish: () => setSaving(false) })
          }}
        >
          <label htmlFor="full_reset_word" className="mt-4 block text-sm font-medium text-taupe-800">
            Type <strong>{word}</strong> to confirm
          </label>
          <input
            id="full_reset_word"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-1.5 block min-h-11 w-full rounded-md border-taupe-300 bg-white text-base tracking-widest uppercase focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
          />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!ready || saving}>
              Reset everything
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// "If it all sells": what the stock on hand should bring in, and the profit
// in it. An estimate: no delivery fees, discounts or deals typed by hand.
function EstimateCard({ estimate, costsOf, uncosted }: { estimate: Estimate; costsOf: number | null; uncosted: number }) {
  const margin = (profit: number, sells: number) => (sells > 0 ? Math.round((profit / sells) * 100) : 0)
  const row = (label: string, sells: number, profit: number | null, main: boolean) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className={main ? 'text-taupe-800' : 'text-sm text-taupe-700'}>{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-3 tabular-nums">
        <span className={main ? 'text-2xl font-semibold text-wine-800' : 'font-semibold'}>{formatMoney(sells)}</span>
        {profit !== null && (
          <span className={`text-sm ${profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            {formatMoney(profit)} profit ({margin(profit, sells)}%)
          </span>
        )}
      </dd>
    </div>
  )

  // Folded to one line (the headline and its profit) so the products stay
  // near the top on a phone. Opening it shows the bulk row and the small print.
  return (
    <details className="group mt-4 rounded-lg border border-taupe-200 bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 focus-visible:outline-2 focus-visible:outline-wine-700 [&::-webkit-details-marker]:hidden">
        <span className="text-taupe-800">If it all sells</span>
        <span className="text-xl font-semibold text-wine-800 tabular-nums">{formatMoney(estimate.sells_for_pesewas)}</span>
        {estimate.profit_pesewas !== null && (
          <span className="text-sm text-emerald-800 tabular-nums">
            {formatMoney(estimate.profit_pesewas)} profit ({margin(estimate.profit_pesewas, estimate.sells_for_pesewas)}%)
          </span>
        )}
        <ChevronDown className="ml-auto size-5 self-center text-taupe-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-taupe-100 px-5 pt-3 pb-4">
        <dl className="space-y-2">
          {row('At your selling prices', estimate.sells_for_pesewas, estimate.profit_pesewas, false)}
          {estimate.bulk && row('If it all went at bulk prices', estimate.bulk.sells_for_pesewas, estimate.bulk.profit_pesewas, false)}
        </dl>
        <p className="mt-3 text-sm text-taupe-600">
          An estimate{costsOf !== null ? `, against the ${formatMoney(costsOf)} it cost you` : ''}. Delivery fees, discounts and deals
          agreed by hand aren't in it.
          {estimate.profit_pesewas !== null && uncosted > 0 && ' Items with no cost yet make the profit look bigger than it is.'}
        </p>
      </div>
    </details>
  )
}

// A product counted as one total: the number, what it means, and how to
// change it. Any size or colour can be sold while the total is above 0.
function PooledBody({ group, canAdjust }: { group: Group; canAdjust: boolean }) {
  async function unpool() {
    const sure = await confirmAction(
      `Count ${group.name} by size and colour again? You will be taken to the stock take to count each size.`,
      { confirm: 'Count by size' },
    )
    if (sure) router.delete(`/admin/stock/pool/${group.id}`) // -> Stock::PoolsController#destroy
  }

  return (
    <div className="border-t border-taupe-200 px-4 py-4">
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-ink tabular-nums">{group.total}</span>
        <span className="text-taupe-700">in stock, all sizes and colours together</span>
      </p>
      <p className="mt-1 text-sm text-taupe-600">
        Any size or colour can be sold while there are some. Sales still record which one was sold.
      </p>
      {canAdjust && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PoolForm group={group} start={group.total} label="Change total" />
          <button type="button" onClick={unpool} className="min-h-10 text-sm font-medium text-wine-800 hover:underline">
            Count by size again
          </button>
        </div>
      )}
    </div>
  )
}

// "How many are there in all?" Opens in place; saving counts the product
// as one total from now on (StockPool.pool!).
function PoolForm({ group, start, label }: { group: Group; start: number; label: string }) {
  const [open, setOpen] = useState(false)
  const [total, setTotal] = useState(String(start))

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-10 text-sm font-medium text-wine-800 hover:underline">
        {label}
      </button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        router.patch(`/admin/stock/pool/${group.id}`, { total }, { preserveScroll: true, onSuccess: () => setOpen(false) })
      }}
      className="flex w-full flex-wrap items-end gap-2 rounded-lg bg-taupe-100 p-3"
    >
      <div className="w-36">
        <label htmlFor={`pool_${group.id}`} className="block text-sm font-medium text-taupe-800">
          How many in all?
        </label>
        <input
          id={`pool_${group.id}`}
          inputMode="numeric"
          autoFocus
          value={total}
          onChange={(e) => setTotal(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="mt-1.5 block min-h-11 w-full rounded-md border-taupe-300 bg-white text-base tabular-nums focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
        />
      </div>
      <Button type="submit" disabled={total === ''}>
        Save
      </Button>
      <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <p className="w-full text-sm text-taupe-700">
        Count every piece of {group.name}, any size or colour. From now on it is counted as one total.
      </p>
    </form>
  )
}
