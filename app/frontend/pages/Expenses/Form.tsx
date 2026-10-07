import { Head, Link, router, useForm } from '@inertiajs/react'
import { ArrowLeft } from 'lucide-react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import ChoicePills from '@/components/ui/ChoicePills'
import MoneyField from '@/components/ui/MoneyField'
import PageHeader from '@/components/ui/PageHeader'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'

// Props from ExpensesController#new and #edit
type Props = {
  expense: { id: number; spent_on: string; category: string; amount: string; note: string; paid_via: string } | null
  today: string
  categories: string[] // ones she has used, then suggestions
  ways_to_pay: { value: string; label: string }[]
}

export default function ExpenseForm({ expense, today, categories, ways_to_pay }: Props) {
  const editing = expense !== null

  const form = useForm({
    spent_on: expense?.spent_on ?? today,
    category: expense?.category ?? '',
    amount: expense?.amount ?? '',
    note: expense?.note ?? '',
    paid_via: expense?.paid_via ?? '',
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ expense: data }))

    if (editing) {
      form.patch(`/expenses/${expense.id}`)
    } else {
      form.post('/expenses')
    }
  }

  async function destroy() {
    if (!editing) return
    if (!(await confirmAction('Delete this expense? It comes off your totals.', { confirm: 'Delete', danger: true }))) return
    router.delete(`/expenses/${expense.id}`)
  }

  return (
    <AppLayout>
      <Head title={editing ? 'Edit expense' : 'Add an expense'} />

      <Link href="/expenses" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Expenses
      </Link>
      <div className="mt-2">
        <PageHeader title={editing ? 'Edit expense' : 'Add an expense'} />
      </div>

      <form onSubmit={submit} className="mt-6 max-w-xl space-y-5">
        <MoneyField
          id="amount"
          label="How much?"
          required
          autoFocus={!editing}
          value={form.data.amount}
          onChange={(e) => {
            form.setData('amount', e.target.value)
            form.clearErrors('amount')
          }}
          error={errors.amount}
        />

        {/* A text box with suggestions. `list` ties it to the <datalist>
            below: the browser offers those as she types, but she can type
            anything, and a new category simply joins the list next time. */}
        <TextField
          id="category"
          label="What was it for?"
          required
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

        <TextField
          id="note"
          label="Note (optional)"
          maxLength={200}
          placeholder="e.g. 200 mailer bags from Makola"
          value={form.data.note}
          onChange={(e) => form.setData('note', e.target.value)}
          error={errors.note}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Record expense'}
          </Button>
          <ButtonLink href="/expenses" variant="secondary">
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
