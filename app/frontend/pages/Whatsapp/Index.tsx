import { Head, Link } from '@inertiajs/react'
import { MessageCircle } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import { useCan } from '@/lib/permissions'

type Chat = { id: number; name: string; phone: string; unread: number; with_fazy: boolean; at: string | null; preview: string | null }

// Props from WhatsappConversationsController#index
export default function WhatsappIndex({ chats, connected, enabled }: { chats: Chat[]; connected: boolean; enabled: boolean }) {
  const can = useCan()

  return (
    <AppLayout>
      <Head title="WhatsApp" />
      <PageHeader title="WhatsApp" description="Chats with customers. The bot answers; take over any chat to reply yourself." />

      {(!connected || !enabled) && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          {!connected ? 'WhatsApp is not connected yet. ' : 'The WhatsApp shop is switched off. '}
          {can('settings.manage') && (
            <Link href="/admin/settings/whatsapp" className="font-medium underline underline-offset-4">
              {!connected ? 'Try the bot and see how to connect' : 'Switch it on'}
            </Link>
          )}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-taupe-200 bg-white">
        {chats.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No chats yet">
            When customers message your WhatsApp, their chats appear here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-taupe-200">
            {chats.map((chat) => (
              <li key={chat.id}>
                <Link href={`/admin/whatsapp/${chat.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-taupe-50">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate ${chat.unread ? 'font-semibold' : 'font-medium'}`}>{chat.name}</span>
                      {chat.with_fazy && <Badge tone="brand">You're replying</Badge>}
                    </span>
                    <span className="block truncate text-sm text-taupe-600">{chat.preview}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-xs text-taupe-500">{chat.at}</span>
                    {chat.unread > 0 && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white tabular-nums">
                        {chat.unread}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
