import { router } from '@inertiajs/react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import Panel from '@/components/ui/Panel'
import { confirmAction } from '@/lib/confirm'
import { usePush } from '@/lib/push'

type Topic = { key: string; label: string; hint: string }
type Device = { id: number; endpoint: string; device: string; topics: string[]; added: string }

export type PushProps = { public_key: string; topics: Topic[]; devices: Device[] }

// "Notifications" on the Account page. Each device is switched on by
// itself (a phone and a laptop are two rows), and each chooses what it
// wants to hear about.
export default function PushSettings({ push }: { push: PushProps }) {
  const { state, endpoint, error, busy, turnOn, turnOff } = usePush(push.public_key)
  const here = push.devices.find((device) => device.endpoint === endpoint)

  async function on() {
    // After Rails has saved the device, ask for the page again so it shows in the list.
    if (await turnOn()) router.reload()
  }

  async function off(device: Device) {
    const mine = device.id === here?.id
    if (!(await confirmAction(`Turn notifications off on ${mine ? 'this device' : `"${device.device}"`}?`, { confirm: 'Turn off', danger: true }))) return
    if (mine) await turnOff()
    router.delete(`/account/push_subscriptions/${device.id}`, { preserveScroll: true })
  }

  function toggle(device: Device, topic: string, wanted: boolean) {
    const topics = wanted ? [...device.topics, topic] : device.topics.filter((key) => key !== topic)
    router.patch(`/account/push_subscriptions/${device.id}`, { topics }, { preserveScroll: true })
  }

  return (
    <Panel title="Notifications">
      <p className="text-taupe-700">A message on this device when something needs you, even with the app closed.</p>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* ----- this device ----- */}
      <div className="mt-4">
        {state === 'off' && (
          <Button type="button" onClick={on} disabled={busy}>
            <Bell className="size-5" aria-hidden="true" />
            {busy ? 'Waiting for your device…' : 'Turn on notifications here'}
          </Button>
        )}
        {state === 'on' && !here && (
          // Subscribed in the browser but Rails has no row (cleared, or
          // another person used this phone). One tap saves it again.
          <Button type="button" onClick={on} disabled={busy}>
            <Bell className="size-5" aria-hidden="true" />
            Turn on notifications here
          </Button>
        )}
        {state === 'needs-install' && (
          <p className="rounded-lg bg-taupe-100 p-4 text-taupe-800">
            On an iPhone, first add the app to your home screen (see "On your phone" above), open it from there, and come back to this page.
          </p>
        )}
        {state === 'blocked' && (
          <p className="flex gap-3 rounded-lg bg-taupe-100 p-4 text-taupe-800">
            <BellOff className="size-5 shrink-0 text-taupe-600" aria-hidden="true" />
            Notifications are blocked for this site on this device. Allow them in your phone's or browser's settings, then come back.
          </p>
        )}
        {state === 'unsupported' && (
          <p className="rounded-lg bg-taupe-100 p-4 text-taupe-800">
            This browser can't show notifications. Try Chrome on Android, or the installed app on an iPhone.
          </p>
        )}
      </div>

      {/* ----- every device that has them on ----- */}
      {push.devices.length > 0 && (
        <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200">
          {push.devices.map((device) => (
            <li key={device.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <BellRing className="size-6 text-wine-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {device.device}
                    {device.id === here?.id && <span className="ml-2 text-sm font-normal text-taupe-700">this device</span>}
                  </p>
                  <p className="text-sm text-taupe-700">On since {device.added}.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-10! px-3!"
                  onClick={() => router.post(`/account/push_subscriptions/${device.id}/test`, {}, { preserveScroll: true })}
                >
                  Send a test
                </Button>
                <Button type="button" variant="danger" className="min-h-10! px-3!" onClick={() => off(device)}>
                  Turn off
                </Button>
              </div>

              <fieldset className="mt-2">
                <legend className="sr-only">What {device.device} is told about</legend>
                {push.topics.map((topic) => (
                  <Checkbox
                    key={topic.key}
                    label={topic.label}
                    description={topic.hint}
                    checked={device.topics.includes(topic.key)}
                    onChange={(event) => toggle(device, topic.key, event.target.checked)}
                  />
                ))}
              </fieldset>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
