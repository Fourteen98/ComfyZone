import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import Button from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import MoneyField from '@/components/ui/MoneyField'
import TextField from '@/components/ui/TextField'
import { toMoneyInput } from '@/lib/format'

type Props = {
  orderId: number
  /** "payment" = money in. "refund" = money back to the buyer. */
  kind: 'payment' | 'refund'
  /** The amount to start with: what is owed, or what there is to give back. */
  suggestedPesewas: number
  ways: { value: string; label: string }[]
  onCancel?: () => void
}

// One form for money moving either way. The two kinds post to different
// controllers (they need different permissions) but ask the same questions.
export default function OrderPaymentForm({ orderId, kind, suggestedPesewas, ways, onCancel }: Props) {
  const refund = kind === 'refund'
  const form = useForm({ amount: toMoneyInput(Math.max(suggestedPesewas, 0)), via: '', reference: '', note: '' })
  const errors = form.errors as Record<string, string[] | undefined>
  // A transaction ID only makes sense where there is one.
  const hasReference = form.data.via === 'momo' || form.data.via === 'bank'

  function submit(event: FormEvent) {
    event.preventDefault()
    // Rails expects { payment: {...} } or { refund: {...} }.
    form.transform((data) =>
      refund
        ? { refund: { amount: data.amount, via: data.via, note: data.note } }
        : { payment: { amount: data.amount, via: data.via, reference: hasReference ? data.reference : '' } },
    )
    // -> Orders::RefundsController#create or Orders::PaymentsController#create
    form.post(`/orders/${orderId}/${refund ? 'refunds' : 'payments'}`, { preserveScroll: true, onSuccess: onCancel })
  }

  // Ids differ per kind so both forms can be on the page at once.
  const id = (field: string) => `${kind}_${field}`

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyField
        id={id('amount')}
        label={refund ? 'How much are you giving back?' : 'How much did they pay?'}
        required
        value={form.data.amount}
        onChange={(e) => {
          form.setData('amount', e.target.value)
          form.clearErrors('amount')
        }}
        error={errors.amount}
      />

      <ChoicePills
        legend={refund ? 'How are you sending it?' : 'How did they pay?'}
        name={id('via')}
        choices={ways}
        value={form.data.via}
        onChange={(via) => {
          form.setData('via', via)
          form.clearErrors('via')
        }}
        error={errors.via}
      />

      {!refund && hasReference && (
        <TextField
          id={id('reference')}
          label="Transaction ID (optional)"
          autoComplete="off"
          maxLength={120}
          value={form.data.reference}
          onChange={(e) => form.setData('reference', e.target.value)}
          error={errors.reference}
        />
      )}

      {refund && (
        <TextField
          id={id('note')}
          label="Why? (optional)"
          autoComplete="off"
          maxLength={120}
          value={form.data.note}
          onChange={(e) => form.setData('note', e.target.value)}
          error={errors.note}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={form.processing}>
          {refund ? 'Record refund' : 'Record payment'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Not now
          </Button>
        )}
      </div>
    </form>
  )
}
