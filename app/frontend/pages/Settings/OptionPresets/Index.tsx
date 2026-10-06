import { Head, Link } from '@inertiajs/react'
import { Plus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import type { OptionValue } from '@/components/OptionValuesEditor'

type Preset = {
  id: number
  name: string
  option_name: string
  values: OptionValue[]
}

const SHOWN = 14

// Props from Settings::OptionPresetsController#index
export default function OptionPresetsIndex({ presets }: { presets: Preset[] }) {
  return (
    <SettingsLayout>
      <Head title="Options" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-taupe-700">
          Ready-made lists of sizes, lengths and colours. When you add a product you pick a list and tick the
          choices it comes in. Changing a list here never changes products you have already added.
        </p>
        <ButtonLink href="/settings/options/new">
          <Plus className="size-5" aria-hidden="true" />
          Add a list
        </ButtonLink>
      </div>

      <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
        {presets.map((preset) => (
          <li key={preset.id}>
            <Link
              href={`/settings/options/${preset.id}/edit`}
              className="block px-5 py-4 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
            >
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {preset.name}
                <Badge>{preset.option_name}</Badge>
              </p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {preset.values.slice(0, SHOWN).map((value) => (
                  <Chip key={value.label} label={value.label} swatch={value.swatch} />
                ))}
                {preset.values.length > SHOWN && (
                  <span className="self-center text-sm text-taupe-700">
                    and {preset.values.length - SHOWN} more
                  </span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </SettingsLayout>
  )
}
