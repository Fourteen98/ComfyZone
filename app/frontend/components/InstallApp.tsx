import { Share, Smartphone } from 'lucide-react'
import Button from '@/components/ui/Button'
import Panel from '@/components/ui/Panel'
import { useInstall } from '@/lib/install'

// "Put this on your phone", shown on the Account page. What it says depends
// on the device, because phones install web apps in different ways.
export default function InstallApp() {
  const { installed, canPrompt, ios, install } = useInstall()

  return (
    <Panel title="On your phone">
      {installed ? (
        <p className="flex items-center gap-3 text-taupe-800">
          <Smartphone className="size-6 shrink-0 text-wine-800" aria-hidden="true" />
          You are using the installed app.
        </p>
      ) : canPrompt ? (
        <div className="space-y-3">
          <p className="text-taupe-800">Add The Comfy Zone to your home screen. It opens full screen, like any other app.</p>
          <Button type="button" onClick={install}>
            <Smartphone className="size-5" aria-hidden="true" />
            Install the app
          </Button>
        </div>
      ) : ios ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-taupe-800">
          <li>Open this page in Safari.</li>
          <li>
            Tap the Share button <Share className="inline size-4 align-text-bottom" aria-label="(a square with an arrow pointing up)" />.
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>.
          </li>
        </ol>
      ) : (
        <p className="text-taupe-800">
          Open your browser's menu (the three dots) and choose <strong>Install app</strong> or{' '}
          <strong>Add to Home screen</strong>. On an iPhone, use Safari's Share button instead.
        </p>
      )}
    </Panel>
  )
}
