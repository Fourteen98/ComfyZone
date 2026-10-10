import { Head, Link, router, useForm } from '@inertiajs/react'
import { ArrowLeft, Plus, X } from 'lucide-react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import MoneyField from '@/components/ui/MoneyField'
import PageHeader from '@/components/ui/PageHeader'
import PhoneField from '@/components/ui/PhoneField'
import SelectField from '@/components/ui/SelectField'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'
import { formatMoney, toMoneyInput, toPesewas } from '@/lib/format'
import { formatPhone } from '@/lib/phone'

type Line = { name: string; quantity: string; unit_cost: string }

// Something bought before, with the last price paid (ExpenseItem.last_prices).
type PastItem = {
  name: string
  unit_cost_pesewas: number
  on: string
  category: string
  supplier_id: number | null
  supplier: string | null
}

// Props from ExpensesController#new and #edit
type Props = {
  expense: {
    id: number
    spent_on: string
    category: string
    amount: string
    note: string
    paid_via: string
    live_session_id: string
    supplier_id: string
    delivery_fee: string
    lines: Line[]
  } | null
  today: string
  categories: string[] // ones she has used, then suggestions
  ways_to_pay: { value: string; label: string }[]
  lives: { id: number; label: string }[] // recent lives, to pin a cost to one
  suppliers: { id: number; name: string; phone: string | null }[]
  preselected_supplier_id: number | null
  past_items: PastItem[]
}

const blankLine = (): Line => ({ name: '', quantity: '', unit_cost: '' })

// Two ways to record money spent:
//
//   Just the amount   "Data and airtime, GH₵ 50"
//   Item by item      "Packaging, from Auntie Ama:
//                        500 × Polymer bags      @ 0.20  = 100.00
//                       1000 × Delivery stickers @ 0.05  =  50.00
//                       Delivery                          15.00
//                                                Total   165.00"
//
// Item by item, the total is added up for her (the server does the same sum;
// this one is only to show it). Item names she has used before are offered
// as she types, and picking one fills in what she paid last time.
export default function ExpenseForm({
  expense,
  today,
  categories,
  ways_to_pay,
  lives,
  suppliers,
  preselected_supplier_id,
  past_items,
}: Props) {
  const editing = expense !== null

  const form = useForm({
    spent_on: expense?.spent_on ?? today,
    category: expense?.category ?? '',
    amount: expense?.amount ?? '',
    note: expense?.note ?? '',
    paid_via: expense?.paid_via ?? '',
    live_session_id: expense?.live_session_id ?? '',
    // An id, 'new' while typing in a supplier not yet on the list, or '' for nobody.
    supplier_id: expense?.supplier_id || String(preselected_supplier_id ?? ''),
    new_supplier_name: '',
    new_supplier_phone: '',
    // Coming from a supplier's page usually means supplies, so start item by item.
    mode: (expense ? (expense.lines.length > 0 ? 'items' : 'amount') : preselected_supplier_id ? 'items' : 'amount') as 'amount' | 'items',
    lines: expense && expense.lines.length > 0 ? expense.lines : [blankLine()],
    delivery_fee: expense?.delivery_fee && expense.delivery_fee !== '0' ? expense.delivery_fee : '',
  })
  const errors = form.errors as Record<string, string | string[] | undefined>
  const itemised = form.data.mode === 'items'
  const addingSupplier = form.data.supplier_id === 'new'
  const pickedSupplier = suppliers.find((supplier) => String(supplier.id) === form.data.supplier_id)

  const lineTotal = (line: Line) => (Number(line.quantity) || 0) * toPesewas(line.unit_cost || '0')
  const itemsTotal = form.data.lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const total = itemsTotal + toPesewas(form.data.delivery_fee || '0')

  const pastByName = new Map(past_items.map((item) => [item.name.toLowerCase(), item]))
  const lastTime = (line: Line) => pastByName.get(line.name.trim().toLowerCase())

  function setLine(index: number, change: Partial<Line>) {
    const lines = form.data.lines.map((line, i) => (i === index ? { ...line, ...change } : line))
    // A known item with no price yet: offer last time's price.
    if (change.name !== undefined) {
      const known = pastByName.get(change.name.trim().toLowerCase())
      if (known && !lines[index].unit_cost) lines[index] = { ...lines[index], unit_cost: toMoneyInput(known.unit_cost_pesewas) }
    }
    form.setData('lines', lines)
    form.clearErrors(...(Object.keys(change).map((key) => `lines.${index}.${key}`) as never[]))
  }

  function removeLine(index: number) {
    const lines = form.data.lines.filter((_, i) => i !== index)
    form.setData('lines', lines.length ? lines : [blankLine()])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
      expense: {
        spent_on: data.spent_on,
        category: data.category,
        note: data.note,
        paid_via: data.paid_via,
        live_session_id: data.live_session_id,
        // Item by item, the amount is worked out on the server.
        amount: itemised ? '' : data.amount,
        lines: itemised ? data.lines : [],
        delivery_fee: itemised ? data.delivery_fee : '',
        supplier_id: data.supplier_id === 'new' ? '' : data.supplier_id,
        new_supplier: data.supplier_id === 'new' ? { name: data.new_supplier_name, phone: data.new_supplier_phone } : undefined,
      },
    }))

    if (editing) {
      form.patch(`/admin/expenses/${expense.id}`)
    } else {
      form.post('/admin/expenses')
    }
  }

  async function destroy() {
    if (!editing) return
    if (!(await confirmAction('Delete this expense? It comes off your totals.', { confirm: 'Delete', danger: true }))) return
    router.delete(`/admin/expenses/${expense.id}`)
  }

  return (
    <AppLayout>
      <Head title={editing ? 'Edit expense' : 'Add an expense'} />

      <Link href="/admin/expenses" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Expenses
      </Link>
      <div className="mt-2">
        <PageHeader title={editing ? 'Edit expense' : 'Add an expense'} />
      </div>

      <form onSubmit={submit} className="mt-6 max-w-xl space-y-5">
        {/* A text box with suggestions. `list` ties it to the <datalist>
            below: the browser offers those as she types, but she can type
            anything, and a new category simply joins the list next time. */}
        <TextField
          id="category"
          label="What was it for?"
          required
          autoFocus={!editing}
          maxLength={40}
          list="expense-categories"
          autoComplete="off"
          placeholder="e.g. Packaging"
          value={form.data.category}
          onChange={(e) => {
            form.setData('category', e.target.value)
            form.clearErrors('category')
          }}
          error={errors.category}
        />
        <datalist id="expense-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <SelectField
          id="supplier_id"
          label="Who did you buy from? (optional)"
          placeholder="Nobody in particular"
          options={[
            ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
            { value: 'new', label: '+ Add a new supplier' },
          ]}
          value={form.data.supplier_id}
          onChange={(e) => {
            form.setData('supplier_id', e.target.value)
            form.clearErrors('supplier' as never)
          }}
          hint={
            pickedSupplier
              ? pickedSupplier.phone
                ? formatPhone(pickedSupplier.phone)
                : 'No phone number saved yet'
              : 'The dealer you buy bags, stickers or tape from. Their number is kept with your suppliers.'
          }
          error={errors.supplier}
        />
        {addingSupplier && (
          <div className="grid gap-5 rounded-lg bg-taupe-100 p-4 sm:grid-cols-2">
            <TextField
              id="new_supplier_name"
              label="Supplier's name"
              required
              maxLength={60}
              autoFocus
              value={form.data.new_supplier_name}
              onChange={(e) => {
                form.setData('new_supplier_name', e.target.value)
                form.clearErrors('new_supplier_name' as never)
              }}
              error={errors.new_supplier_name}
            />
            <PhoneField
              id="new_supplier_phone"
              label="Phone number"
              required
              value={form.data.new_supplier_phone}
              onChange={(phone) => {
                form.setData('new_supplier_phone', phone)
                form.clearErrors('new_supplier_phone' as never)
              }}
              error={errors.new_supplier_phone}
            />
          </div>
        )}

        <ChoicePills
          legend="How do you want to record it?"
          name="mode"
          choices={[
            { value: 'amount', label: 'Just the amount' },
            { value: 'items', label: 'Item by item' },
          ]}
          value={form.data.mode}
          onChange={(mode) => form.setData('mode', mode as 'amount' | 'items')}
        />

        {itemised ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-taupe-800">What did you buy?</legend>
            {form.data.lines.map((line, index) => {
              const known = lastTime(line)
              return (
                <div key={index} className="rounded-lg border border-taupe-200 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <TextField
                        id={`line_${index}_name`}
                        label="Item"
                        maxLength={60}
                        list="past-items"
                        autoComplete="off"
                        placeholder="e.g. Polymer bags (medium)"
                        value={line.name}
                        onChange={(e) => setLine(index, { name: e.target.value })}
                        error={errors[`lines.${index}.name`]}
                      />
                    </div>
                    {form.data.lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        aria-label={`Remove ${line.name || 'this item'}`}
                        className="mt-7 grid size-11 shrink-0 place-items-center rounded-md text-taupe-600 hover:bg-taupe-100 hover:text-wine-800 focus-visible:outline-2 focus-visible:outline-wine-700"
                      >
                        <X className="size-5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-[5.5rem_1fr_auto] items-end gap-3">
                    <TextField
                      id={`line_${index}_quantity`}
                      label="How many"
                      inputMode="numeric"
                      placeholder="0"
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: e.target.value.replace(/\D/g, '') })}
                      error={errors[`lines.${index}.quantity`]}
                    />
                    <MoneyField
                      id={`line_${index}_unit_cost`}
                      label="Each"
                      placeholder="0.00"
                      value={line.unit_cost}
                      onChange={(e) => setLine(index, { unit_cost: e.target.value })}
                      error={errors[`lines.${index}.unit_cost`]}
                    />
                    <p className="min-h-11 pb-2.5 text-right font-semibold tabular-nums">{formatMoney(lineTotal(line))}</p>
                  </div>
                  {known && (
                    <p className="mt-2 text-sm text-taupe-600">
                      Last time {formatMoney(known.unit_cost_pesewas)} each{known.supplier && `, from ${known.supplier}`}, {known.on}.
                    </p>
                  )}
                </div>
              )
            })}
            <datalist id="past-items">
              {past_items.map((item) => (
                <option key={item.name} value={item.name} />
              ))}
            </datalist>
            <Button type="button" variant="secondary" onClick={() => form.setData('lines', [...form.data.lines, blankLine()])}>
              <Plus className="size-5" aria-hidden="true" />
              Add another item
            </Button>

            <div className="w-48">
              <MoneyField
                id="delivery_fee"
                label="Delivery (optional)"
                placeholder="0.00"
                value={form.data.delivery_fee}
                onChange={(e) => {
                  form.setData('delivery_fee', e.target.value)
                  form.clearErrors('delivery_fee')
                }}
                error={errors.delivery_fee}
              />
            </div>

            <p className="flex items-baseline justify-between rounded-lg bg-taupe-100 px-4 py-3">
              <span className="font-medium">Total</span>
              <span className="text-xl font-semibold text-wine-800 tabular-nums">{formatMoney(total)}</span>
            </p>
            {errors.amount && <p className="text-sm text-red-700">Add at least one item with a price.</p>}
          </fieldset>
        ) : (
          <MoneyField
            id="amount"
            label="How much?"
            required
            value={form.data.amount}
            onChange={(e) => {
              form.setData('amount', e.target.value)
              form.clearErrors('amount')
            }}
            error={errors.amount}
          />
        )}

        <div className="w-48">
          <TextField
            id="spent_on"
            label="When?"
            type="date"
            required
            max={today}
            value={form.data.spent_on}
            onChange={(e) => {
              form.setData('spent_on', e.target.value)
              form.clearErrors('spent_on')
            }}
            error={errors.spent_on}
          />
        </div>

        <ChoicePills
          legend="How did you pay? (optional)"
          name="paid_via"
          choices={ways_to_pay}
          value={form.data.paid_via}
          onChange={(paid_via) => form.setData('paid_via', paid_via)}
          error={errors.paid_via}
        />

        {lives.length > 0 && (
          <SelectField
            id="live_session_id"
            label="For a live? (optional)"
            placeholder="Not for one live"
            options={lives.map((live) => ({ value: live.id, label: live.label }))}
            value={form.data.live_session_id}
            onChange={(e) => form.setData('live_session_id', e.target.value)}
            hint="Data, a host, lights hired for that live. It is taken off that live's profit."
          />
        )}

        <TextField
          id="note"
          label="Note (optional)"
          maxLength={200}
          placeholder={itemised ? 'e.g. Delivered to the house' : 'e.g. MTN bundle for the Friday live'}
          value={form.data.note}
          onChange={(e) => form.setData('note', e.target.value)}
          error={errors.note}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : itemised && total > 0 ? `Record ${formatMoney(total)}` : 'Record expense'}
          </Button>
          <ButtonLink href="/admin/expenses" variant="secondary">
            Cancel
          </ButtonLink>
          {editing && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </AppLayout>
  )
}
