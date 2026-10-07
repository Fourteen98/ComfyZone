import { Head, router, useForm } from '@inertiajs/react'
import { AtSign, Phone } from 'lucide-react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import ChoiceCards from '@/components/ui/ChoiceCards'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'

type Kind = 'social' | 'direct'

type Props = {
  // null when adding; the channel when editing.
  channel: { id: number; name: string; kind: Kind; active: boolean; orders_count: number } | null
}

export default function SalesChannelForm({ channel }: Props) {
  const editing = channel !== null

  const form = useForm({
    name: channel?.name ?? '',
    kind: (channel?.kind ?? '') as Kind | '',
    active: channel?.active ?? true,
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ sales_channel: data }))

    if (editing) {
      form.patch(`/admin/settings/channels/${channel.id}`)
    } else {
      form.post('/admin/settings/channels')
    }
  }

  async function destroy() {
    if (!editing) return
    const kept =
      channel.orders_count === 0
        ? ''
        : ` Its ${channel.orders_count === 1 ? '1 order is' : `${channel.orders_count} orders are`} kept, with no channel. To keep the history, hide it instead.`
    if (!(await confirmAction(`Delete "${channel.name}"?${kept}`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/admin/settings/channels/${channel.id}`)
  }

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${channel.name}` : 'Add a channel'} />

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <h2 className="font-display text-3xl font-semibold text-wine-800">
          {editing ? `Edit ${channel.name}` : 'Add a channel'}
        </h2>

        <TextField
          id="name"
          label="Name"
          required
          maxLength={30}
          placeholder="e.g. Instagram, or Saturday market"
          autoFocus={!editing}
          value={form.data.name}
          onChange={(e) => {
            form.setData('name', e.target.value)
            form.clearErrors('name')
          }}
          error={errors.name}
        />

        <ChoiceCards
          legend="How do you know your buyers there?"
          name="kind"
          choices={[
            { value: 'social', label: 'By a username', description: 'TikTok, Instagram...', icon: AtSign },
            { value: 'direct', label: 'By name or number', description: 'WhatsApp, calls, in person', icon: Phone },
          ]}
          value={form.data.kind}
          onChange={(kind) => {
            form.setData('kind', kind)
            form.clearErrors('kind')
          }}
          error={errors.kind}
        />

        {editing && (
          <Checkbox
            label="Offer this when recording a sale"
            description="Untick to hide it without deleting. Orders already under it stay there."
            checked={form.data.active}
            onChange={(e) => form.setData('active', e.target.checked)}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add channel'}
          </Button>
          <ButtonLink href="/admin/settings/channels" variant="secondary">
            Cancel
          </ButtonLink>
          {editing && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete channel
            </Button>
          )}
        </div>
      </form>
    </SettingsLayout>
  )
}
