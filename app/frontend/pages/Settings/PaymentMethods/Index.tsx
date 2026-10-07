import { Head, Link, router } from '@inertiajs/react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'

type MethodRow = { id: number; name: string; wants_reference: boolean; active: boolean; used_count: number }

const arrow =
  'flex size-10 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100 hover:text-wine-800 focus-visible:outline-2 focus-visible:outline-wine-700 disabled:opacity-30 disabled:hover:bg-transparent'

// Props from Settings::PaymentMethodsController#index
export default function PaymentMethodsIndex({ methods }: { methods: MethodRow[] }) {
  const used = (count: number) => (count === 0 ? 'Not used yet' : count === 1 ? 'Used once' : `Used ${count} times`)

  // -> Settings::PaymentMethodsController#move
  const move = (method: MethodRow, direction: 'up' | 'down') =>
    router.patch(`/settings/payments/${method.id}/move`, { direction }, { preserveScroll: true })

  return (
    <SettingsLayout>
      <Head title="Payment methods" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-taupe-700">
          The ways money moves, offered whenever you record a payment, a refund or an expense. They show in this
          order.
        </p>
        <ButtonLink href="/settings/payments/new">
          <Plus className="size-5" aria-hidden="true" />
          Add a method
        </ButtonLink>
      </div>

      <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
        {methods.map((method, index) => (
          <li key={method.id} className="flex items-center gap-1 pr-2">
            <Link
              href={`/settings/payments/${method.id}/edit`}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
            >
              <span className={`font-medium ${method.active ? '' : 'text-taupe-600'}`}>{method.name}</span>
              {method.wants_reference && <span className="text-sm text-taupe-700">Asks for a transaction ID</span>}
              {!method.active && <Badge tone="muted">Hidden</Badge>}
              <span className="ml-auto text-sm text-taupe-700 tabular-nums">{used(method.used_count)}</span>
            </Link>
            <button
              type="button"
              className={arrow}
              onClick={() => move(method, 'up')}
              disabled={index === 0}
              aria-label={`Move ${method.name} up`}
            >
              <ArrowUp className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={arrow}
              onClick={() => move(method, 'down')}
              disabled={index === methods.length - 1}
              aria-label={`Move ${method.name} down`}
            >
              <ArrowDown className="size-5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </SettingsLayout>
  )
}
