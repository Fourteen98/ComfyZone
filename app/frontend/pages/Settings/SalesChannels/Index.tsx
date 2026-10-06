import { Head, Link, router } from '@inertiajs/react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'

type ChannelRow = { id: number; name: string; kind: 'social' | 'direct'; active: boolean; orders_count: number }

const arrow =
  'flex size-10 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100 hover:text-wine-800 focus-visible:outline-2 focus-visible:outline-wine-700 disabled:opacity-30 disabled:hover:bg-transparent'

// Props from Settings::SalesChannelsController#index
export default function SalesChannelsIndex({ channels }: { channels: ChannelRow[] }) {
  const orders = (count: number) => (count === 1 ? '1 order' : `${count} orders`)

  // -> Settings::SalesChannelsController#move
  const move = (channel: ChannelRow, direction: 'up' | 'down') =>
    router.patch(`/settings/channels/${channel.id}/move`, { direction }, { preserveScroll: true })

  return (
    <SettingsLayout>
      <Head title="Sales channels" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-taupe-700">
          Where your sales come from. You pick one each time you record a sale, so you can see which ones bring in the
          most. They show in this order.
        </p>
        <ButtonLink href="/settings/channels/new">
          <Plus className="size-5" aria-hidden="true" />
          Add a channel
        </ButtonLink>
      </div>

      <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
        {channels.map((channel, index) => (
          <li key={channel.id} className="flex items-center gap-1 pr-2">
            <Link
              href={`/settings/channels/${channel.id}/edit`}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
            >
              <span className={`font-medium ${channel.active ? '' : 'text-taupe-600'}`}>{channel.name}</span>
              <span className="text-sm text-taupe-700">
                {channel.kind === 'social' ? 'Buyers have a username' : 'Buyers give a name or number'}
              </span>
              {!channel.active && <Badge tone="muted">Hidden</Badge>}
              <span className="ml-auto text-sm text-taupe-700 tabular-nums">{orders(channel.orders_count)}</span>
            </Link>
            <button
              type="button"
              className={arrow}
              onClick={() => move(channel, 'up')}
              disabled={index === 0}
              aria-label={`Move ${channel.name} up`}
            >
              <ArrowUp className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={arrow}
              onClick={() => move(channel, 'down')}
              disabled={index === channels.length - 1}
              aria-label={`Move ${channel.name} down`}
            >
              <ArrowDown className="size-5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </SettingsLayout>
  )
}
