import { Head, Link, useForm } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import MoneyField from '@/components/ui/MoneyField'
import Chip from '@/components/ui/Chip'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import SelectField from '@/components/ui/SelectField'
import TextField from '@/components/ui/TextField'
import StockLevelBadge from '@/components/StockLevelBadge'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney, toMoneyInput } from '@/lib/format'
import { adjustmentReasons, reasonLabels } from '@/lib/stock'
import type { StockLevel } from '@/lib/stock'

type Movement = {
  id: number
  at: string
  quantity: number // + in, - out
  balance_after: number
  reason: string
  note: string | null
  by: string | null
  source: { label: string; href: string } | null
}

type Props = {
  variant: {
    id: number
    name: string
    sku: string
    active: boolean
    option_values: (OptionValue & { name: string })[]
    stock: number
    level: StockLevel
    low_stock_at: number
    average_cost_pesewas: number | null // null = may not see costs
    product: { id: number; name: string }
  }
  movements: Movement[]
  movements_total: number
  can_adjust: boolean
  can_set_cost: boolean
  siblings_without_cost: number
}

// Props from StockController#show
export default function StockShow({ variant, movements, movements_total, can_adjust, can_set_cost, siblings_without_cost }: Props) {
  const form = useForm({ reason: '', quantity: '', note: '' })
  const errors = form.errors as Record<string, string[] | undefined>

  const chosen = adjustmentReasons.find((reason) => reason.value === form.data.reason)
  const direction = chosen?.direction
  const amount = Number.parseInt(form.data.quantity, 10)
  const typed = form.data.quantity !== '' && Number.isFinite(amount)

  // What the count will become, shown before she saves. Rails works out the
  // real figure again at the moment of saving, from the latest number.
  const after = !typed || !direction ? null : direction === 'set' ? amount : direction === 'out' ? variant.stock - amount : variant.stock + amount

  // ----- what one cost (for stock that never came through a purchase) -----
  const noCost = variant.average_cost_pesewas === 0
  const costForm = useForm({
    cost: variant.average_cost_pesewas ? toMoneyInput(variant.average_cost_pesewas) : '',
    whole_product: siblings_without_cost > 0,
  })
  const costErrors = costForm.errors as Record<string, string[] | undefined>

  function saveCost(event: FormEvent) {
    event.preventDefault()
    costForm.patch(`/stock/${variant.id}/cost`, { preserveScroll: true }) // -> Stock::CostsController#update
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ adjustment: data }))
    // -> Stock::AdjustmentsController#create
    form.post(`/stock/${variant.id}/adjustments`, { preserveScroll: true, onSuccess: () => form.reset() })
  }

  return (
    <AppLayout>
      <Head title={`${variant.product.name}, ${variant.name}`} />

      <Link href="/stock" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Stock
      </Link>

      <div className="mt-2">
        <PageHeader title={variant.product.name} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="flex flex-wrap gap-1.5">
          {variant.option_values.map((value) => (
            <Chip key={value.name} label={value.label} swatch={value.swatch} />
          ))}
        </p>
        <p className="text-sm text-taupe-700">{variant.sku}</p>
        {!variant.active && <Badge tone="muted">No longer offered</Badge>}
        <Link href={`/products/${variant.product.id}`} className="text-sm font-medium text-wine-800 underline underline-offset-4">
          Open the product
        </Link>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:sticky xl:top-6">
          <section className="rounded-lg border border-taupe-200 bg-white p-5">
            <p className="text-sm text-taupe-700">In stock now</p>
            <p className="mt-1 flex items-center gap-3">
              <span className="text-5xl font-semibold text-wine-800 tabular-nums">{variant.stock}</span>
              <StockLevelBadge level={variant.level} />
            </p>
            <p className="mt-2 text-sm text-taupe-700">
              {variant.low_stock_at > 0 ? `Warns you at ${variant.low_stock_at} or fewer.` : 'Low stock warnings are off for this product.'}
              {variant.average_cost_pesewas !== null &&
                variant.average_cost_pesewas > 0 &&
                ` Each one cost you ${formatMoney(variant.average_cost_pesewas)} on average.`}
            </p>
          </section>

          {can_set_cost && (
            <Panel title="What each one cost you">
              <form onSubmit={saveCost} className="space-y-4">
                <p className="text-sm text-taupe-700">
                  {noCost
                    ? 'The app has not been told. Until it is, this item counts as GH₵ 0 in your stock value, and selling it looks like pure profit.'
                    : 'Worked out from your purchases. Change it only if it is wrong; the next purchase is blended in as usual.'}
                </p>
                <MoneyField
                  id="cost"
                  aria-label="What each one cost you"
                  placeholder="0.00"
                  required
                  value={costForm.data.cost}
                  onChange={(e) => {
                    costForm.setData('cost', e.target.value)
                    costForm.clearErrors('cost')
                  }}
                  error={costErrors.cost}
                />
                {siblings_without_cost > 0 && (
                  <Checkbox
                    label={`Use it for the ${siblings_without_cost} other ${siblings_without_cost === 1 ? 'option' : 'options'} of ${variant.product.name} with no cost yet`}
                    checked={costForm.data.whole_product}
                    onChange={(e) => costForm.setData('whole_product', e.target.checked)}
                  />
                )}
                <Button type="submit" block variant={noCost ? 'primary' : 'secondary'} disabled={costForm.processing}>
                  Save the cost
                </Button>
              </form>
            </Panel>
          )}

          {can_adjust && (
            <Panel title="Correct the count">
              <form onSubmit={submit} className="space-y-4">
                <SelectField
                  id="reason"
                  label="What happened?"
                  required
                  placeholder="Choose one"
                  options={adjustmentReasons.map((reason) => ({ value: reason.value, label: reason.label }))}
                  value={form.data.reason}
                  onChange={(e) => {
                    form.setData({ ...form.data, reason: e.target.value, quantity: '' })
                    form.clearErrors()
                  }}
                  error={errors.reason}
                />

                {direction && (
                  <>
                    <TextField
                      id="quantity"
                      // The question changes with the reason, so it is always
                      // clear what number belongs in the box.
                      label={direction === 'set' ? 'How many are there?' : direction === 'out' ? 'How many to take off?' : 'How many to add?'}
                      inputMode="numeric"
                      required
                      autoComplete="off"
                      value={form.data.quantity}
                      onChange={(e) => {
                        form.setData('quantity', e.target.value.replace(/\D/g, '').slice(0, 6))
                        form.clearErrors('quantity')
                      }}
                      error={errors.quantity}
                    />

                    {after !== null && (
                      <p className={`text-sm ${after < 0 ? 'text-red-800' : 'text-taupe-800'}`} role="status">
                        {after < 0
                          ? `There are only ${variant.stock} in stock.`
                          : after === variant.stock
                            ? `That is what the app already shows.`
                            : `Stock will go from ${variant.stock} to ${after}.`}
                      </p>
                    )}

                    <TextField
                      id="note"
                      label="Note (optional)"
                      maxLength={200}
                      placeholder="Anything worth remembering"
                      value={form.data.note}
                      onChange={(e) => form.setData('note', e.target.value)}
                      error={errors.note}
                    />

                    <Button type="submit" block disabled={form.processing}>
                      Update stock
                    </Button>
                  </>
                )}
              </form>
            </Panel>
          )}
        </div>

        <Panel title="History" className="xl:col-span-2">
          {movements.length === 0 ? (
            <p className="text-taupe-700">Nothing has happened to this item yet. It will show here when a purchase arrives.</p>
          ) : (
            <>
              <ol className="-mx-5 -my-5 divide-y divide-taupe-200">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex items-center gap-4 px-5 py-3">
                    {/* The sign is written out, so + and - never rely on colour alone. */}
                    <span
                      className={`w-14 shrink-0 text-right text-xl font-semibold tabular-nums ${
                        movement.quantity > 0 ? 'text-emerald-800' : 'text-red-800'
                      }`}
                    >
                      {movement.quantity > 0 ? `+${movement.quantity}` : `−${Math.abs(movement.quantity)}`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {reasonLabels[movement.reason] ?? movement.reason}
                        {movement.source && (
                          <Link href={movement.source.href} className="ml-2 text-sm font-normal text-wine-800 underline underline-offset-4">
                            See the {movement.source.label.toLowerCase()}
                          </Link>
                        )}
                      </p>
                      <p className="text-sm text-taupe-700">
                        {movement.at}
                        {movement.by && `, by ${movement.by}`}
                      </p>
                      {movement.note && <p className="mt-0.5 text-sm text-taupe-800">"{movement.note}"</p>}
                    </div>
                    <p className="text-right text-sm text-taupe-700 tabular-nums">
                      then <span className="block text-base font-semibold text-ink">{movement.balance_after}</span>
                    </p>
                  </li>
                ))}
              </ol>
              {movements_total > movements.length && (
                <p className="mt-8 text-sm text-taupe-700">Showing the latest {movements.length} of {movements_total}.</p>
              )}
            </>
          )}
        </Panel>
      </div>
    </AppLayout>
  )
}
