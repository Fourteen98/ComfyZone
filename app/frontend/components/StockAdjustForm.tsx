import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import Button from '@/components/ui/Button'
import SelectField from '@/components/ui/SelectField'
import TextField from '@/components/ui/TextField'
import { adjustmentReasons } from '@/lib/stock'

type Props = {
  variant: { id: number; stock: number }
  /** Start on this reason ("found" for a quick "add stock"). */
  reason?: string
  /** Sent back to the stock list afterwards, with its search kept. */
  back?: { q: string; show: string }
  /** Keeps ids unique when several are on one page. */
  idPrefix?: string
}

// "Correct the count": what happened, how many, an optional note.
// On an item's own page, and opened inline on the stock list after a search.
// -> Stock::AdjustmentsController#create
export default function StockAdjustForm({ variant, reason = '', back, idPrefix = '' }: Props) {
  const form = useForm({ reason, quantity: '', note: '' })
  const errors = form.errors as Record<string, string[] | undefined>
  const id = (name: string) => `${idPrefix}${name}`

  const chosen = adjustmentReasons.find((entry) => entry.value === form.data.reason)
  const direction = chosen?.direction
  const amount = Number.parseInt(form.data.quantity, 10)
  const typed = form.data.quantity !== '' && Number.isFinite(amount)

  // What the count will become, shown before she saves. Rails works out the
  // real figure again at the moment of saving, from the latest number.
  const after = !typed || !direction ? null : direction === 'set' ? amount : direction === 'out' ? variant.stock - amount : variant.stock + amount

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ adjustment: data, ...(back ? { back: 'list', q: back.q, show: back.show } : {}) }))
    form.post(`/admin/stock/${variant.id}/adjustments`, { preserveScroll: true, onSuccess: () => form.reset() })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SelectField
        id={id('reason')}
        label="What happened?"
        required
        placeholder="Choose one"
        options={adjustmentReasons.map((entry) => ({ value: entry.value, label: entry.label }))}
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
            id={id('quantity')}
            // The question changes with the reason, so it is always clear
            // what number belongs in the box.
            label={direction === 'set' ? 'How many are there?' : direction === 'out' ? 'How many to take off?' : 'How many to add?'}
            inputMode="numeric"
            required
            autoComplete="off"
            autoFocus={reason !== ''}
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
            id={id('note')}
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
  )
}
