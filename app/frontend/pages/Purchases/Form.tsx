import { Head, Link, useForm } from '@inertiajs/react'
import { Search, Shirt, Store, Trash2, Truck } from 'lucide-react'
import { useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import ChoiceCards from '@/components/ui/ChoiceCards'
import MoneyField from '@/components/ui/MoneyField'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import QuantityStepper from '@/components/ui/QuantityStepper'
import SelectField from '@/components/ui/SelectField'
import TextAreaField from '@/components/ui/TextAreaField'
import TextField from '@/components/ui/TextField'
import type { OptionValue } from '@/components/OptionValuesEditor'
import LocationFields, { nowhere } from '@/components/LocationFields'
import type { Locations } from '@/components/LocationFields'
import { formatForeign, formatMoney, toPesewas } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import PhoneField from '@/components/ui/PhoneField'

type PickableVariant = { id: number; name: string; option_values: (OptionValue & { name: string })[]; stock: number }
type PickableProduct = {
  id: number
  name: string
  thumb_url: string | null
  last_cost: string // what one cost last time, "" if never bought
  variants: PickableVariant[]
}

type Props = {
  // null when recording a new purchase.
  purchase: {
    id: number
    received: boolean // already in stock: saving corrects stock
    purchased_on: string
    supplier_id: number | null
    reference: string
    delivery_method: 'pickup' | 'delivery'
    transport_cost: string
    extra_costs: string
    note: string
    currency: string
    exchange_rate: string
    // In the purchase's own currency.
    items: { variant_id: number; quantity: number; unit_cost: string }[]
  } | null
  // What a purchase can be paid in. The first one is cedis.
  currencies: { code: string; name: string; symbol: string }[]
  today: string
  locations: Locations
  suppliers: { id: number; name: string; phone: string | null; product_ids: number[] }[]
  // Set when she came from a supplier's page.
  preselected_supplier_id: number | null
  products: PickableProduct[]
}

const HOME_CURRENCY = 'GHS' // Currency::HOME in Ruby

// One product on the purchase, as edited on screen: a cost for each unit,
// and how many of each variant.
type Block = { productId: number; cost: string; quantities: Record<number, string> }

export default function PurchaseForm({ purchase, today, suppliers, preselected_supplier_id, products, locations, currencies }: Props) {
  const editing = purchase !== null
  const byId = new Map(products.map((product) => [product.id, product]))

  const form = useForm({
    purchased_on: purchase?.purchased_on ?? today,
    // An id, or 'new' while she is typing in a supplier not yet on the list.
    supplier_id: String(purchase?.supplier_id ?? preselected_supplier_id ?? ''),
    new_supplier_name: '',
    new_supplier_phone: '',
    new_supplier_where: nowhere(locations.home),
    reference: purchase?.reference ?? '',
    // Deliberately empty on a new purchase: she must say which it was.
    delivery_method: (purchase?.delivery_method ?? '') as 'pickup' | 'delivery' | '',
    transport_cost: purchase?.transport_cost ?? '',
    extra_costs: purchase?.extra_costs ?? '',
    note: purchase?.note ?? '',
    currency: purchase?.currency ?? HOME_CURRENCY,
    exchange_rate: purchase?.exchange_rate ?? '',
    blocks: blocksFrom(purchase?.items ?? [], products),
  })
  const errors = form.errors as Record<string, string[] | undefined>
  const [search, setSearch] = useState('')

  // Change a simple field and clear its error, so a red message doesn't
  // linger after she has fixed the problem.
  function set(
    field: 'purchased_on' | 'new_supplier_name' | 'new_supplier_phone' | 'reference' | 'transport_cost' | 'extra_costs' | 'note' | 'exchange_rate',
    value: string,
  ) {
    form.setData(field, value)
    form.clearErrors(field)
  }

  const blocks = form.data.blocks
  const setBlocks = (next: Block[]) => {
    form.setData('blocks', next)
    form.clearErrors('items' as never)
  }
  const patchBlock = (productId: number, patch: Partial<Block>) =>
    setBlocks(blocks.map((block) => (block.productId === productId ? { ...block, ...patch } : block)))

  // ----- currency -----
  // Goods bought abroad: the cost boxes are in the supplier's currency, and
  // the rate turns them into cedis. `rate` here is only for the running
  // totals on screen; Rails does the exact sum on save (PurchaseItem#price_in_foreign).
  const currency = currencies.find((entry) => entry.code === form.data.currency) ?? currencies[0]
  const foreign = currency.code !== HOME_CURRENCY
  const rate = foreign ? Number.parseFloat(form.data.exchange_rate) || 0 : 1
  const inCedis = (minor: number) => Math.round(minor * rate)

  function addProduct(product: PickableProduct) {
    // "Last time" is a cedi figure, so it only pre-fills a cedi purchase.
    setBlocks([...blocks, { productId: product.id, cost: foreign ? '' : product.last_cost, quantities: {} }])
    setSearch('')
  }

  // ----- live totals, worked out as she types (all in pesewas) -----
  const unitsOf = (block: Block) => Object.values(block.quantities).reduce((sum, q) => sum + (Number.parseInt(q, 10) || 0), 0)
  // toPesewas reads "12.50" as 1250 whatever the currency: cents work the same way.
  const paidOf = (block: Block) => unitsOf(block) * toPesewas(block.cost) // in the purchase's currency
  const goodsOf = (block: Block) => unitsOf(block) * inCedis(toPesewas(block.cost)) // in cedis
  const units = blocks.reduce((sum, block) => sum + unitsOf(block), 0)
  const goods = blocks.reduce((sum, block) => sum + goodsOf(block), 0)
  const paid = blocks.reduce((sum, block) => sum + paidOf(block), 0)
  const transport = toPesewas(form.data.transport_cost)
  const fees = toPesewas(form.data.extra_costs)
  const extra = transport + fees // everything paid on top of the goods

  const addingSupplier = form.data.supplier_id === 'new'
  const pickedSupplier = suppliers.find((supplier) => String(supplier.id) === form.data.supplier_id)
  const pickup = form.data.delivery_method === 'pickup'

  // Roughly what one unit of this product costs once transport and fees are
  // shared in by value. Rails does the exact sum when the goods arrive.
  function landedEach(block: Block): number | null {
    const blockUnits = unitsOf(block)
    if (extra === 0 || blockUnits === 0 || goods === 0) return null
    return Math.round((goodsOf(block) + (extra * goodsOf(block)) / goods) / blockUnits)
  }

  // The two save buttons differ only in `receive`.
  function save(receive: boolean) {
    form.transform((data) => ({
      receive,
      purchase: {
        purchased_on: data.purchased_on,
        // Either an existing supplier's id, or the details of a new one.
        supplier_id: data.supplier_id === 'new' ? '' : data.supplier_id,
        new_supplier:
          data.supplier_id === 'new'
            ? { name: data.new_supplier_name, phone: data.new_supplier_phone, ...data.new_supplier_where }
            : undefined,
        reference: data.reference,
        delivery_method: data.delivery_method,
        transport_cost: data.transport_cost,
        extra_costs: data.extra_costs,
        note: data.note,
        currency: data.currency,
        exchange_rate: data.currency === HOME_CURRENCY ? '' : data.exchange_rate,
        items: data.blocks.flatMap((block) =>
          Object.entries(block.quantities)
            .filter(([, quantity]) => (Number.parseInt(quantity, 10) || 0) > 0)
            .map(([variantId, quantity]) => ({ variant_id: Number(variantId), quantity: Number(quantity), unit_cost: block.cost })),
        ),
      },
    }))

    if (editing) {
      form.patch(`/admin/purchases/${purchase.id}`) // -> PurchasesController#update
    } else {
      form.post('/admin/purchases') // -> PurchasesController#create
    }
  }

  const added = new Set(blocks.map((block) => block.productId))
  const term = search.trim().toLowerCase()
  const available = products.filter((product) => !added.has(product.id) && product.name.toLowerCase().includes(term))

  // Offer the chosen supplier's own products first: they are the likely picks.
  const theirs = new Set(pickedSupplier?.product_ids ?? [])
  const fromSupplier = available.filter((product) => theirs.has(product.id))
  const others = available.filter((product) => !theirs.has(product.id))
  const groups = [
    { title: fromSupplier.length ? `${pickedSupplier?.name} sells` : '', products: fromSupplier.slice(0, 8) },
    { title: fromSupplier.length ? 'Your other products' : '', products: others.slice(0, fromSupplier.length ? 4 : 8) },
  ].filter((group) => group.products.length > 0)

  return (
    <AppLayout>
      <Head title={editing ? 'Edit purchase' : 'Record a purchase'} />
      <PageHeader title={purchase?.received ? 'Correct this purchase' : editing ? 'Edit purchase' : 'Record a purchase'} />
      {purchase?.received && (
        <div className="mt-4 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950">
          These goods are already in your stock. Change anything that was wrong or left out, and stock is corrected to match:
          items you add go in, items you remove or lower come out, and a corrected price re-values what is still on the shelf.
          Sales already made keep the cost they had.
        </div>
      )}

      {/* The form has no single submit: each button says what it will do. */}
      <form onSubmit={(event) => event.preventDefault()} className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {errors.base && <Alert tone="error">{errors.base[0]}</Alert>}

          <Panel title="The purchase">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id="purchased_on"
                label="Date bought"
                type="date"
                required
                max={today}
                value={form.data.purchased_on}
                onChange={(e) => set('purchased_on', e.target.value)}
                error={errors.purchased_on}
              />
              <SelectField
                id="supplier_id"
                label="Supplier"
                required
                placeholder="Choose who you bought from"
                options={[
                  ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
                  { value: 'new', label: '+ Add a new supplier' },
                ]}
                value={form.data.supplier_id}
                onChange={(e) => {
                  form.setData('supplier_id', e.target.value)
                  form.clearErrors('supplier' as never)
                }}
                hint={pickedSupplier ? (pickedSupplier.phone ? formatPhone(pickedSupplier.phone) : 'No phone number saved yet') : undefined}
                error={errors.supplier}
              />
            </div>

            {/* Most purchases are in cedis, so this is one quiet select until
                another currency is chosen; then the rate box appears. */}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <SelectField
                id="currency"
                label="Paid the supplier in"
                options={currencies.map((entry) => ({ value: entry.code, label: `${entry.name} (${entry.symbol})` }))}
                value={form.data.currency}
                onChange={(e) => {
                  form.setData('currency', e.target.value)
                  form.clearErrors('currency', 'exchange_rate')
                }}
                error={errors.currency}
              />
              {foreign && (
                <MoneyField
                  id="exchange_rate"
                  label={`What 1 ${currency.name} cost you`}
                  placeholder="0.00"
                  required
                  value={form.data.exchange_rate}
                  onChange={(e) => set('exchange_rate', e.target.value)}
                  hint="The rate you got, in cedis. Up to 4 decimal places, like 15.5 or 0.0092."
                  error={errors.exchange_rate}
                />
              )}
            </div>
            {foreign && (
              <p className="mt-3 max-w-xl text-sm text-taupe-700">
                Type each cost below in {currency.symbol} ({currency.name}). Transport and other fees stay in cedis.
              </p>
            )}

            {/* Shown only when "+ Add a new supplier" is chosen. The supplier
                is saved together with the purchase. */}
            {addingSupplier && (
              <div className="mt-5 grid gap-5 rounded-lg bg-taupe-100 p-4 sm:grid-cols-2">
                <TextField
                  id="new_supplier_name"
                  label="Supplier's name"
                  required
                  maxLength={60}
                  autoFocus
                  value={form.data.new_supplier_name}
                  onChange={(e) => set('new_supplier_name', e.target.value)}
                  error={errors.new_supplier_name}
                />
                <PhoneField
                  id="new_supplier_phone"
                  label="Phone number"
                  required
                  value={form.data.new_supplier_phone}
                  onChange={(phone) => set('new_supplier_phone', phone)}
                  error={errors.new_supplier_phone}
                />
                {/* Where they are. For goods bought abroad, pick the country. */}
                <div className="sm:col-span-2">
                  <LocationFields
                    name="new_supplier_where"
                    value={form.data.new_supplier_where}
                    locations={locations}
                    onChange={(where) => form.setData('new_supplier_where', where)}
                  />
                </div>
              </div>
            )}
          </Panel>

          <Panel title="What you bought">
            {products.length === 0 ? (
              <p className="text-taupe-700">
                You have no products yet.{' '}
                <Link href="/admin/products/new" className="font-medium text-wine-800 underline underline-offset-4">
                  Add a product
                </Link>{' '}
                first, then come back to record buying it.
              </p>
            ) : (
              <>
                {errors.items && (
                  <div className="mb-4">
                    <Alert tone="error">{errors.items[0]}</Alert>
                  </div>
                )}

                <div className="space-y-4">
                  {blocks.map((block) => {
                    const product = byId.get(block.productId)
                    if (!product) return null
                    const landed = landedEach(block)

                    return (
                      <fieldset key={block.productId} className="rounded-lg border border-taupe-200 p-4">
                        <legend className="sr-only">{product.name}</legend>

                        <div className="flex items-center gap-3">
                          <Thumb url={product.thumb_url} />
                          <p className="min-w-0 flex-1 truncate font-display text-2xl font-semibold text-wine-800">{product.name}</p>
                          <button
                            type="button"
                            onClick={() => setBlocks(blocks.filter((b) => b.productId !== block.productId))}
                            aria-label={`Remove ${product.name}`}
                            className="flex size-11 items-center justify-center rounded-md text-taupe-700 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
                          >
                            <Trash2 className="size-5" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="mt-4 max-w-xs">
                          <MoneyField
                            id={`cost_${product.id}`}
                            label="What each one cost you"
                            placeholder="0.00"
                            symbol={currency.symbol}
                            value={block.cost}
                            onChange={(e) => patchBlock(product.id, { cost: e.target.value })}
                            hint={product.last_cost ? `Last time: ${formatMoney(toPesewas(product.last_cost))}` : undefined}
                          />
                        </div>

                        <p className="mt-4 text-sm font-medium text-taupe-800">How many of each</p>
                        <ul className="mt-1.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                          {product.variants.map((variant) => (
                            <li key={variant.id} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="flex flex-wrap gap-1.5">
                                  {variant.option_values.length === 0 ? (
                                    <span>{product.name}</span>
                                  ) : (
                                    variant.option_values.map((value) => (
                                      <Chip key={value.name} label={value.label} swatch={value.swatch} />
                                    ))
                                  )}
                                </p>
                                <p className="mt-0.5 text-sm text-taupe-600 tabular-nums">{variant.stock} in stock now</p>
                              </div>
                              <QuantityStepper
                                label={`${product.name} ${variant.name}`}
                                value={block.quantities[variant.id] ?? ''}
                                onChange={(value) => patchBlock(product.id, { quantities: { ...block.quantities, [variant.id]: value } })}
                              />
                            </li>
                          ))}
                        </ul>

                        <p className="mt-4 border-t border-taupe-200 pt-3 text-sm text-taupe-700 tabular-nums">
                          {unitsOf(block)} {unitsOf(block) === 1 ? 'item' : 'items'},{' '}
                          {foreign
                            ? `${formatForeign(paidOf(block), currency.symbol)}${rate > 0 ? `, which is ${formatMoney(goodsOf(block))}` : ''}`
                            : formatMoney(goodsOf(block))}
                          .
                          {landed !== null && (
                            <span className="text-ink">
                              {' '}
                              With {pickup ? 'the trip' : 'delivery'}
                              {fees > 0 ? ' and fees' : ''}, each really costs about {formatMoney(landed)}.
                            </span>
                          )}
                        </p>
                      </fieldset>
                    )
                  })}
                </div>

                {/* ---------- Product picker ---------- */}
                <div className={blocks.length ? 'mt-5 border-t border-taupe-200 pt-5' : ''}>
                  <label htmlFor="product-search" className="block text-sm font-medium text-taupe-800">
                    {blocks.length ? 'Add another product' : 'Find the product you bought'}
                  </label>
                  <div className="relative mt-1.5">
                    <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-taupe-500" aria-hidden="true" />
                    <input
                      id="product-search"
                      type="search"
                      placeholder="Search by name"
                      autoComplete="off"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="block min-h-12 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
                    />
                  </div>

                  {groups.length > 0 ? (
                    groups.map((group) => (
                      <div key={group.title || 'all'}>
                        {group.title && <p className="mt-3 text-sm font-medium text-taupe-800">{group.title}</p>}
                        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                          {group.products.map((product) => (
                            <li key={product.id}>
                              <button
                                type="button"
                                onClick={() => addProduct(product)}
                                className="flex w-full items-center gap-3 rounded-md border border-taupe-200 bg-white p-2 text-left hover:border-wine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
                              >
                                <Thumb url={product.thumb_url} />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{product.name}</span>
                                  <span className="block text-sm text-taupe-700">
                                    {product.variants.length === 1 ? 'One item' : `${product.variants.length} variants`}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="mt-2 text-sm text-taupe-700">
                      {term ? `No product matches "${search.trim()}".` : 'Every product is already on this purchase.'}
                    </p>
                  )}
                </div>
              </>
            )}
          </Panel>

          <Panel title="Getting the goods to you">
            <div className="space-y-5">
              <ChoiceCards
                legend="How did they get to you?"
                name="delivery_method"
                choices={[
                  { value: 'pickup', label: 'We picked them up', description: 'You or someone you sent went for them', icon: Store },
                  { value: 'delivery', label: 'They were delivered', description: 'Brought to you by the supplier or a rider', icon: Truck },
                ]}
                value={form.data.delivery_method}
                onChange={(value) => {
                  form.setData('delivery_method', value)
                  form.clearErrors('delivery_method')
                }}
                error={errors.delivery_method}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <MoneyField
                  id="transport_cost"
                  label={pickup ? 'What the trip cost you' : 'What you paid for delivery'}
                  placeholder="0.00"
                  value={form.data.transport_cost}
                  onChange={(e) => set('transport_cost', e.target.value)}
                  hint={pickup ? 'Fuel, taxi or trotro, loading. Leave empty if nothing.' : 'Leave empty if delivery was free.'}
                  error={errors.transport_cost}
                />
                <MoneyField
                  id="extra_costs"
                  label="Other fees (optional)"
                  placeholder="0.00"
                  value={form.data.extra_costs}
                  onChange={(e) => set('extra_costs', e.target.value)}
                  hint="Duty, handling, anything else."
                  error={errors.extra_costs}
                />
              </div>
              <p className="max-w-xl text-sm text-taupe-700">
                These are part of what the goods cost you. They are shared across the items by value, so your profit on
                each sale is worked out from what the item really cost.
              </p>
            </div>
          </Panel>

          <Panel title="Reference and notes">
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  id="reference"
                  label="Reference (optional)"
                  maxLength={60}
                  placeholder="Invoice or waybill number"
                  value={form.data.reference}
                  onChange={(e) => set('reference', e.target.value)}
                  error={errors.reference}
                />
              </div>
              <TextAreaField
                id="note"
                label="Note (optional)"
                maxLength={500}
                value={form.data.note}
                onChange={(e) => set('note', e.target.value)}
                error={errors.note}
              />
            </div>
          </Panel>
        </div>

        {/* ---------- Summary and save ---------- */}
        <div className="space-y-4 xl:sticky xl:top-6">
          <Panel title="Summary">
            <dl className="space-y-2 tabular-nums">
              <Row label={units === 1 ? '1 item' : `${units} items`} value={formatMoney(goods)} />
              {foreign && (
                <p className="-mt-1 text-sm text-taupe-700">
                  {formatForeign(paid, currency.symbol)}
                  {rate > 0 ? ` at ${form.data.exchange_rate} cedis each` : '. Add the rate to see it in cedis'}
                </p>
              )}
              <Row label={pickup ? 'Pick-up trip' : 'Delivery'} value={formatMoney(transport)} />
              {fees > 0 && <Row label="Other fees" value={formatMoney(fees)} />}
              <div className="flex items-baseline justify-between border-t border-taupe-200 pt-3">
                <dt className="font-medium">You paid</dt>
                <dd className="text-2xl font-semibold text-wine-800">{formatMoney(goods + extra)}</dd>
              </div>
            </dl>
          </Panel>

          <div className="space-y-2">
            {purchase?.received ? (
              <Button type="button" block disabled={form.processing} onClick={() => save(false)}>
                Save and correct stock
              </Button>
            ) : (
              <>
                <Button type="button" block disabled={form.processing} onClick={() => save(true)}>
                  Save and add to stock
                </Button>
                <Button type="button" block variant="secondary" disabled={form.processing} onClick={() => save(false)}>
                  Save, goods still on the way
                </Button>
                <p className="px-1 text-sm text-taupe-700">
                  If the goods have not arrived, save them as on the way and mark them arrived later. You can still
                  correct a purchase after it is in stock.
                </p>
              </>
            )}
            <ButtonLink href={editing ? `/admin/purchases/${purchase.id}` : '/admin/purchases'} variant="secondary" block>
              Cancel
            </ButtonLink>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-taupe-700">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="flex aspect-[4/5] w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-taupe-200 text-taupe-500">
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <Shirt className="size-5" aria-hidden="true" />}
    </span>
  )
}

// Saved lines -> blocks, one per product, when editing.
function blocksFrom(items: { variant_id: number; quantity: number; unit_cost: string }[], products: PickableProduct[]): Block[] {
  const productOf = new Map<number, number>()
  for (const product of products) for (const variant of product.variants) productOf.set(variant.id, product.id)

  const blocks: Block[] = []
  for (const item of items) {
    const productId = productOf.get(item.variant_id)
    if (productId === undefined) continue // product archived since; leave it out

    let block = blocks.find((b) => b.productId === productId)
    if (!block) {
      block = { productId, cost: item.unit_cost, quantities: {} }
      blocks.push(block)
    }
    block.quantities[item.variant_id] = String(item.quantity)
  }
  return blocks
}
