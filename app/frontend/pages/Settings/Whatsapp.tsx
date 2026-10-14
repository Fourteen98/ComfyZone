import { Head, router, useForm } from '@inertiajs/react'
import { CheckCircle2, CircleDashed, RotateCcw, Send } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import Panel from '@/components/ui/Panel'
import TextField from '@/components/ui/TextField'
import ChatThread from '@/components/ChatThread'
import type { ChatMessage } from '@/components/ChatThread'

// Props from Settings::WhatsappController#show
type Props = {
  setting: { enabled: boolean; hold_minutes: number; momo_number: string; momo_name: string; momo_network: string; welcome: string }
  connection: { connected: boolean; keys: Record<string, boolean>; webhook_url: string; last_inbound: string | null }
  trial: ChatMessage[] // the "Try it" chat
}

export default function WhatsappSettings({ setting, connection, trial }: Props) {
  const form = useForm({ ...setting, hold_minutes: String(setting.hold_minutes) })
  const errors = form.errors as Record<string, string | string[] | undefined>
  const [typed, setTyped] = useState('')

  function save(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ whatsapp: data }))
    form.patch('/admin/settings/whatsapp', { preserveScroll: true }) // -> Settings::WhatsappController#update
  }

  // "Try it": say something as a customer would. Rails answers at once.
  function say(data: { text: string; id?: string }) {
    router.post('/admin/settings/whatsapp/try', data, { preserveScroll: true, only: ['trial'], onSuccess: () => setTyped('') })
  }

  return (
    <SettingsLayout>
      <Head title="WhatsApp" />
      <p className="max-w-2xl text-taupe-700">
        Customers message your WhatsApp, see what's in stock, choose colour and size, and reserve. A reservation is a real order that holds
        the stock until they pay, or until the time runs out.
      </p>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Panel title="The WhatsApp shop">
            <form onSubmit={save} className="space-y-5">
              <Checkbox
                label="Open: the bot answers customers"
                description="Off: it only says Fazy will reply soon. Chats you take over are never answered by the bot."
                checked={form.data.enabled}
                onChange={(e) => form.setData('enabled', e.target.checked)}
              />
              <div className="max-w-xs">
                <TextField
                  id="hold_minutes"
                  label="Minutes to pay before a reservation is released"
                  inputMode="numeric"
                  value={form.data.hold_minutes}
                  onChange={(e) => form.setData('hold_minutes', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  error={errors.hold_minutes}
                />
                <p className="mt-1.5 text-sm text-taupe-700">They get a reminder 3 minutes before. Saying "I've paid" stops the clock.</p>
              </div>
              <fieldset className="grid gap-4 rounded-lg bg-taupe-100 p-4 sm:grid-cols-3">
                <legend className="sr-only">How customers pay</legend>
                <p className="text-sm font-medium text-taupe-800 sm:col-span-3">Mobile money the bot sends for payment</p>
                <TextField
                  id="momo_number"
                  label="Number"
                  inputMode="tel"
                  placeholder="024 123 4567"
                  value={form.data.momo_number}
                  onChange={(e) => form.setData('momo_number', e.target.value)}
                  error={errors.momo_number}
                />
                <TextField
                  id="momo_name"
                  label="Name on it"
                  value={form.data.momo_name}
                  onChange={(e) => form.setData('momo_name', e.target.value)}
                  error={errors.momo_name}
                />
                <TextField
                  id="momo_network"
                  label="Network"
                  placeholder="MTN"
                  value={form.data.momo_network}
                  onChange={(e) => form.setData('momo_network', e.target.value)}
                />
              </fieldset>
              <TextField
                id="welcome"
                label="Welcome line (optional)"
                maxLength={120}
                placeholder="Welcome to The Comfy Zone by Fazy"
                value={form.data.welcome}
                onChange={(e) => form.setData('welcome', e.target.value)}
                error={errors.welcome}
              />
              <Button type="submit" disabled={form.processing}>
                Save
              </Button>
            </form>
          </Panel>

          <Panel title="Connection to WhatsApp">
            <p className="flex items-center gap-2 font-medium">
              {connection.connected ? (
                <>
                  <CheckCircle2 className="size-5 text-emerald-700" aria-hidden="true" />
                  Connected
                </>
              ) : (
                <>
                  <CircleDashed className="size-5 text-taupe-500" aria-hidden="true" />
                  Not connected yet: messages stay here as tests
                </>
              )}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {Object.entries(connection.keys).map(([key, present]) => (
                <li key={key} className="flex items-center gap-2">
                  <span className={present ? 'text-emerald-700' : 'text-taupe-400'}>{present ? '✓' : '○'}</span>
                  <code className="text-xs">{key}</code>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-taupe-700">Webhook address to give Meta:</p>
            <code className="mt-1 block rounded bg-taupe-100 px-2 py-1.5 text-sm break-all">{connection.webhook_url}</code>
            <p className="mt-3 text-sm text-taupe-600">
              {connection.last_inbound ? `Last message from a customer: ${connection.last_inbound}.` : 'No customer messages received yet.'}{' '}
              Setting up is explained in docs/whatsapp-setup.md.
            </p>
          </Panel>
        </div>

        {/* A pretend customer chat: the bot answers for real, but nothing is
            sent and no order or stock is touched. */}
        <Panel
          title="Try it"
          action={
            trial.length > 0 && (
              <button
                type="button"
                onClick={() => router.delete('/admin/settings/whatsapp/try', { preserveScroll: true })}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-wine-800 hover:bg-taupe-100"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Start again
              </button>
            )
          }
        >
          <p className="-mt-1 mb-3 text-sm text-taupe-700">
            Chat as a customer would. Tap the bot's buttons. Nothing is sent to anyone, and reserving here saves no order.
          </p>
          <div className="-mx-5 overflow-hidden border-y border-taupe-200">
            <ChatThread messages={trial} onChoose={(choice) => say({ text: choice.title, id: choice.id })} height="h-[28rem]" />
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (typed.trim()) say({ text: typed.trim() })
            }}
            className="mt-3 flex gap-2"
          >
            <input
              aria-label="Message as a customer"
              placeholder={trial.length ? 'Type a message' : 'Say "hi", or type what you want: "black dress XL"'}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="block min-h-11 min-w-0 flex-1 rounded-full border-taupe-300 bg-white px-4 text-base focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
            />
            <Button type="submit" aria-label="Send">
              <Send className="size-5" aria-hidden="true" />
            </Button>
          </form>
        </Panel>
      </div>
    </SettingsLayout>
  )
}
