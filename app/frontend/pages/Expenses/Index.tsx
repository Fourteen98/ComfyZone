import { Head, Link } from '@inertiajs/react'
import { Plus, Wallet } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import BarList from '@/components/ui/BarList'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import { formatMoney } from '@/lib/format'

type Expense = {
  id: number
  spent_on: string
  category: string
  amount_pesewas: number
  note: string | null
  paid_via: string | null
  by: string
}

// Props from ExpensesController#index
type Props = {
  period: { key: string; label: string; from: string; to: string; today: string }
  presets: { key: string; label: string }[]
  total_pesewas: number
  by_category: { name: string; amount_pesewas: number }[]
  expenses: Expense[]
  can_manage: boolean
}

export default function ExpensesIndex({ period, presets, total_pesewas, by_category, expenses, can_manage }: Props) {
  const tab = (on: boolean) =>
    `flex min-h-11 shrink-0 items-center rounded-full border px-4 font-medium ${
      on ? 'border-wine-800 bg-wine-800 text-taupe-50' : 'border-taupe-300 bg-white hover:border-wine-700'
    }`

  return (
    <AppLayout>
      <Head title="Expenses" />

      <PageHeader
        title="Expenses"
        description="What the business spends that isn't stock: packaging, data, riders, adverts, rent."
        actions={
          can_manage && (
            <ButtonLink href="/admin/expenses/new">
              <Plus className="size-5" aria-hidden="true" />
              Add an expense
            </ButtonLink>
          )
        }
      />

      <nav aria-label="Period" className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {presets.map((preset) => (
          <Link
            key={preset.key}
            href="/admin/expenses"
            data={{ range: preset.key }}
            aria-current={period.key === preset.key ? 'page' : undefined}
            className={tab(period.key === preset.key)}
          >
            {preset.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <section className="rounded-lg border border-taupe-200 bg-white p-5">
            <p className="text-sm text-taupe-700">Spent, {period.label}</p>
            <p className="mt-1 text-4xl font-semibold text-wine-800 tabular-nums">{formatMoney(total_pesewas)}</p>
          </section>

          {by_category.length > 0 && (
            <Panel title="What on">
              <BarList
                empty=""
                format={formatMoney}
                rows={by_category.map((row) => ({ key: row.name, label: row.name, value: row.amount_pesewas }))}
              />
            </Panel>
          )}
        </div>

        <div className="rounded-lg border border-taupe-200 bg-white xl:col-span-2">
          {expenses.length === 0 ? (
            <EmptyState icon={Wallet} title="Nothing spent in this period">
              Record what you spend on running the business, and your reports will show what is really left.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-taupe-200">
              {expenses.map((expense) => {
                const body = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{expense.category}</span>
                      <span className="block text-sm text-taupe-600">
                        {expense.spent_on}
                        {expense.paid_via && `, ${expense.paid_via.toLowerCase()}`}
                        {expense.note && `. ${expense.note}`}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(expense.amount_pesewas)}</span>
                  </>
                )
                return (
                  <li key={expense.id}>
                    {can_manage ? (
                      <Link href={`/admin/expenses/${expense.id}/edit`} className="flex items-baseline gap-3 px-5 py-3 hover:bg-taupe-50">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-baseline gap-3 px-5 py-3">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
