import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, Bot, Hand, Send } from 'lucide-react'
import { useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Button from '@/components/ui/Button'
import Panel from '@/components/ui/Panel'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import PhoneLinks from '@/components/PhoneLinks'
import ChatThread from '@/components/ChatThread'
import type { ChatMessage } from '@/components/ChatThread'
import type { OrderStatus } from '@/lib/orders'
import { formatMoney } from '@/lib/format'

// Props from WhatsappConversationsController#show
type Props = {
  chat: {
    id: number
    name: string
    phone: string
    customer_id: number | null
    with_fazy: boolean
    window_open: boolean // WhatsApp lets us write freely for 24 h after they last wrote
    window_closes: string | null
  }
  messages: ChatMessage[]
  orders: { id: number; status: OrderStatus; total_pesewas: number; at: string; hold_until: string | null; payment_claim: string | null }[]
  can_reply: boolean
}

export default function WhatsappShow({ chat, messages, orders, can_reply }: Props) {
  const [body, setBody] = useState('')

  function send() {
    if (!body.trim()) return
    router.post(`/admin/whatsapp/${chat.id}/reply`, { body }, { preserveScroll: true, onSuccess: () => setBody('') })
  }

  return (
    <AppLayout>
      <Head title={`WhatsApp: ${chat.name}`} />
      <Link href="/admin/whatsapp" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        WhatsApp
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-wine-800">{chat.name}</h1>
          <PhoneLinks phone={chat.phone} />
        </div>
        {can_reply &&
          (chat.with_fazy ? (
            <Button type="button" variant="secondary" onClick={() => router.patch(`/admin/whatsapp/${chat.id}/hand_back`)}>
              <Bot className="size-5" aria-hidden="true" />
              Hand back to the bot
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => router.patch(`/admin/whatsapp/${chat.id}/take_over`)}>
              <Hand className="size-5" aria-hidden="true" />
              Take over this chat
            </Button>
          ))}
      </div>
      <p className="mt-1 text-sm text-taupe-700">
        {chat.with_fazy ? 'You are replying; the bot stays quiet here.' : 'The bot is answering this chat.'}
      </p>

      <div className="mt-5 grid items-start gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-taupe-200 bg-white xl:col-span-2">
          <ChatThread messages={messages} />
          {can_reply && (
            <div className="border-t border-taupe-200 p-3">
              {chat.window_open ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    send()
                  }}
                  className="flex gap-2"
                >
                  <textarea
                    aria-label="Your reply"
                    rows={1}
                    placeholder="Type a reply"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    className="block min-h-11 min-w-0 flex-1 resize-none rounded-2xl border-taupe-300 bg-white px-4 py-2.5 text-base focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
                  />
                  <Button type="submit" aria-label="Send">
                    <Send className="size-5" aria-hidden="true" />
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-taupe-700">
                  More than 24 hours since they last wrote, so WhatsApp only allows approved template messages (coming next). Message them
                  from your phone instead.
                </p>
              )}
              {chat.window_open && chat.window_closes && (
                <p className="mt-1.5 text-xs text-taupe-500">
                  You can reply freely until {chat.window_closes}. Replying takes the chat over from the bot.
                </p>
              )}
            </div>
          )}
        </div>

        <Panel title="Their orders">
          {orders.length === 0 ? (
            <p className="text-taupe-700">
              None from WhatsApp yet.
              {chat.customer_id && (
                <>
                  {' '}
                  <Link href={`/admin/customers/${chat.customer_id}`} className="font-medium text-wine-800 underline">
                    See the customer
                  </Link>
                </>
              )}
            </p>
          ) : (
            <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/admin/orders/${order.id}`} className="block px-5 py-3 hover:bg-taupe-50">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">#{order.id}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(order.total_pesewas)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-taupe-600">
                      <OrderStatusBadge status={order.status} />
                      {order.at}
                    </span>
                    {order.status === 'claimed' && order.payment_claim && (
                      <span className="mt-1 block text-sm font-medium text-amber-900">
                        Says they paid: {order.payment_claim}. Check and record it.
                      </span>
                    )}
                    {order.status === 'claimed' && !order.payment_claim && order.hold_until && (
                      <span className="mt-1 block text-sm text-taupe-700">Held until {order.hold_until}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppLayout>
  )
}
