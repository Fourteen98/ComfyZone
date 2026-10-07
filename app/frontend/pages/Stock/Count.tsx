import { Head, Link, router, usePage } from '@inertiajs/react'
import { ArrowLeft, Search } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import PageHeader from '@/components/ui/PageHeader'
import type { OptionValue } from '@/components/OptionValuesEditor'

type Variant = { id: number; name: string; option_values: (OptionValue & { name: string })[]; stock: number }
type Product = { id: number; name: string; variants: Variant[] }

// Props from Stock::CountsController#new
export default function StockCount({ products }: { products: Product[] }) {
  const errors = usePage().props.errors as Record<string, string[] | undefined>
  // What she has typed so far: variant id -> count, as text. Blank means
  // "not counted", which is different from 0 ("I looked, there are none").
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const term = search.trim().toLowerCase()
  const shown = products.filter((product) => product.name.toLowerCase().includes(term))

  const all = products.flatMap((product) => product.variants)
  const counted = all.filter((variant) => (counts[variant.id] ?? '') !== '')
  const different = counted.filter((variant) => Number.parseInt(counts[variant.id], 10) !== variant.stock)

  function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    // Only what she typed is sent. -> Stock::CountsController#create
    router.post('/stock/count', { counts: Object.fromEntries(counted.map((variant) => [variant.id, counts[variant.id]])) }, { onFinish: () => setSaving(false) })
  }

  return (
    <AppLayout>
      <Head title="Stock take" />

      <Link href="/stock" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Stock
      </Link>
      <div className="mt-2">
        <PageHeader
          title="Stock take"
          description="Count what is on the shelf and type the number beside each item. Leave a box empty for anything you didn't count."
        />
      </div>

      {/* pb leaves room for the bar that floats above the phone's menu. */}
      <form onSubmit={save} className="mt-6 max-w-3xl pb-24 lg:pb-0">
        {errors.counts && (
          <div className="mb-4">
            <Alert tone="error">{errors.counts[0]}. Nothing was saved.</Alert>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-taupe-500" aria-hidden="true" />
          <input
            type="search"
            aria-label="Find a product"
            placeholder="Find a product"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block min-h-12 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
          />
        </div>

        {shown.length === 0 && <p className="mt-6 text-center text-taupe-700">No product matches "{search.trim()}".</p>}

        {shown.map((product) => (
          <section key={product.id} className="mt-5 rounded-lg border border-taupe-200 bg-white">
            <h2 className="border-b border-taupe-200 px-5 py-3 font-display text-xl font-semibold text-wine-800">{product.name}</h2>
            <ul className="divide-y divide-taupe-200">
              {product.variants.map((variant) => {
                const typed = counts[variant.id] ?? ''
                const changed = typed !== '' && Number.parseInt(typed, 10) !== variant.stock
                return (
                  <li key={variant.id} className="flex items-center gap-3 px-5 py-2.5">
                    <label htmlFor={`count_${variant.id}`} className="min-w-0 flex-1">
                      <span className="flex flex-wrap gap-1.5">
                        {variant.option_values.length === 0 ? (
                          <span className="text-taupe-800">One kind only</span>
                        ) : (
                          variant.option_values.map((value) => <Chip key={value.name} label={value.label} swatch={value.swatch} />)
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-taupe-600 tabular-nums">
                        The app says {variant.stock}
                        {changed && <span className="font-medium text-wine-800">, will become {Number.parseInt(typed, 10)}</span>}
                      </span>
                    </label>
                    <input
                      id={`count_${variant.id}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="–"
                      value={typed}
                      // Digits only, so a slip of the thumb can't type "1o".
                      onChange={(e) => setCounts({ ...counts, [variant.id]: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      className={`min-h-12 w-20 rounded-md bg-white text-center text-lg tabular-nums focus:border-wine-700 focus:ring-1 focus:ring-wine-700 ${
                        changed ? 'border-wine-800 bg-wine-50 font-semibold' : 'border-taupe-300'
                      }`}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {/* The summary and Save stay in reach while she scrolls a long list. */}
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-taupe-200 bg-white px-4 py-2.5 shadow-[0_-4px_16px_rgb(42_31_29/0.12)] lg:sticky lg:bottom-4 lg:mt-6 lg:rounded-lg lg:border lg:px-5">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-taupe-800" aria-live="polite">
              {counted.length === 0
                ? 'Nothing counted yet.'
                : `${counted.length} counted, ${different.length} ${different.length === 1 ? 'differs' : 'differ'}.`}
            </p>
            <ButtonLink href="/stock" variant="secondary" className="max-sm:hidden">
              Cancel
            </ButtonLink>
            <Button type="submit" disabled={saving || counted.length === 0}>
              {saving ? 'Saving…' : 'Save the count'}
            </Button>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
