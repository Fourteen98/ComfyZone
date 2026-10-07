import { Head, Link, router, useForm } from '@inertiajs/react'
import { Archive, Pencil, RotateCcw, Store } from 'lucide-react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Badge from '@/components/ui/Badge'
import Button, { ButtonLink } from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import MoneyField from '@/components/ui/MoneyField'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import ProductGallery from '@/components/ProductGallery'
import type { Photo } from '@/components/ProductGallery'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import StockLevelBadge from '@/components/StockLevelBadge'
import type { StockLevel } from '@/lib/stock'
import { confirmAction } from '@/lib/confirm'

type VariantRow = {
  id: number
  name: string
  sku: string
  option_values: (OptionValue & { name: string })[]
  price: string // "" when it follows the product price
  stock: number | null // null = this person may not see stock
  level: StockLevel | null
  average_cost_pesewas: number | null // null = may not see costs
  selling_price_pesewas: number
}

type Props = {
  product: {
    id: number
    name: string
    description: string | null
    status: 'active' | 'archived'
    listed: boolean // on the public shop
    shop_path: string
    category: string | null
    price_pesewas: number
    options: { name: string; values: OptionValue[] }[]
    suppliers: { id: number; name: string; phone: string | null }[] | null // null = may not see purchases
    photos: Photo[]
    max_photos: number
    variants: VariantRow[]
  }
}

// Props from ProductsController#show
export default function ProductShow({ product }: Props) {
  const can = useCan()
  const manage = can('products.manage')
  const archived = product.status === 'archived'

  // One form holding every variant's price, keyed by variant id.
  const form = useForm({
    prices: Object.fromEntries(product.variants.map((v) => [v.id, v.price])) as Record<number, string>,
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function savePrices(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
      variants: product.variants.map((v) => ({ id: v.id, price: data.prices[v.id] ?? '' })),
    }))
    // -> Products::VariantPricesController#update
    form.patch(`/admin/products/${product.id}/variant_prices`, { preserveScroll: true })
  }

  async function archive() {
    if (!(await confirmAction(`Archive ${product.name}? It leaves your product list but keeps its history.`, { confirm: 'Archive' }))) return
    router.patch(`/admin/products/${product.id}/archive`)
  }

  return (
    <AppLayout>
      <Head title={product.name} />

      <PageHeader
        title={product.name}
        description={product.description ?? undefined}
        actions={
          manage &&
          (archived ? (
            <Button type="button" variant="secondary" onClick={() => router.patch(`/admin/products/${product.id}/restore`)}>
              <RotateCcw className="size-5" aria-hidden="true" />
              Make active again
            </Button>
          ) : (
            <>
              <ButtonLink href={`/admin/products/${product.id}/edit`} variant="secondary">
                <Pencil className="size-5" aria-hidden="true" />
                Edit
              </ButtonLink>
              {/* The quick switch: on the shop, or off it. -> ProductsController#listing */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.patch(`/admin/products/${product.id}/listing`, { listed: !product.listed }, { preserveScroll: true })}
              >
                <Store className="size-5" aria-hidden="true" />
                {product.listed ? 'Take off the shop' : 'Put on the shop'}
              </Button>
              <Button type="button" variant="secondary" onClick={archive}>
                <Archive className="size-5" aria-hidden="true" />
                Archive
              </Button>
            </>
          ))
        }
      />

      {/* Photos on the left, details on the right. On phones they stack,
          photos first. `items-start` plus `sticky` keeps the gallery in view
          while a long list of variants scrolls past. */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6">
          <ProductGallery
            productId={product.id}
            productName={product.name}
            photos={product.photos}
            maxPhotos={product.max_photos}
            manage={manage && !archived}
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {archived && <Badge tone="muted">Archived</Badge>}
            {!archived && product.listed && (
              // A plain <a>: the shop is a different layout, and a new tab
              // keeps her place in the back office.
              <a href={product.shop_path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline">
                <Badge tone="success">On the shop</Badge>
                <span className="text-sm text-wine-800 underline underline-offset-4">See it there</span>
              </a>
            )}
            {product.category && <Badge>{product.category}</Badge>}
            <p>
              <span className="text-taupe-700">Selling price </span>
              <span className="text-2xl font-semibold text-wine-800 tabular-nums">
                {formatMoney(product.price_pesewas)}
              </span>
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {product.options.map((option) => (
              <p key={option.name} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 text-taupe-700">{option.name}</span>
                {option.values.map((value) => (
                  <Chip key={value.label} label={value.label} swatch={value.swatch} />
                ))}
              </p>
            ))}
          </div>

          {product.suppliers !== null && (
            <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="w-16 text-taupe-700">From</span>
              {product.suppliers.length === 0 ? (
                <span className="text-taupe-600">No supplier yet</span>
              ) : (
                product.suppliers.map((supplier, index) => (
                  <span key={supplier.id}>
                    <Link
                      href={`/admin/suppliers/${supplier.id}`}
                      className="font-medium text-wine-800 underline decoration-taupe-400 underline-offset-4 hover:decoration-wine-800"
                    >
                      {supplier.name}
                    </Link>
                    {index < product.suppliers!.length - 1 && ','}
                  </span>
                ))
              )}
            </p>
          )}

          <form onSubmit={savePrices} className="mt-6">
        <Panel
          title={product.variants.length === 1 ? 'What you sell' : `${product.variants.length} variants`}
          action={
            manage &&
            !archived && (
              <Button type="submit" className="min-h-10! px-4!" disabled={form.processing || !form.isDirty}>
                Save prices
              </Button>
            )
          }
        >
          {manage && !archived && product.variants.length > 1 && (
            <p className="mb-3 text-sm text-taupe-700">
              Leave a price empty to use the selling price above. Type one to charge differently for that variant.
            </p>
          )}

          {/* Rows wrap on phones, so this stays readable without a wide table. */}
          <ul className="-mx-5 divide-y divide-taupe-200 border-t border-taupe-200">
            {product.variants.map((variant) => (
              <li key={variant.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
                <div className="min-w-40 flex-1">
                  <p className="flex flex-wrap gap-1.5">
                    {variant.option_values.length === 0 ? (
                      <span className="font-medium">{product.name}</span>
                    ) : (
                      variant.option_values.map((value) => (
                        <Chip key={value.name} label={value.label} swatch={value.swatch} />
                      ))
                    )}
                  </p>
                  <p className="mt-1 text-sm text-taupe-600 tabular-nums">
                    {variant.sku}
                    {variant.average_cost_pesewas !== null && variant.average_cost_pesewas > 0 && (
                      <span>, costs you {formatMoney(variant.average_cost_pesewas)}</span>
                    )}
                  </p>
                </div>

                {variant.stock !== null && (
                  // Links to the item's stock history, where the count can be corrected.
                  <Link
                    href={`/admin/stock/${variant.id}`}
                    className="flex w-32 items-center justify-end gap-2 rounded-md py-1 tabular-nums hover:underline"
                  >
                    <StockLevelBadge level={variant.level} />
                    <span>
                      <span className="font-semibold">{variant.stock}</span> in stock
                    </span>
                  </Link>
                )}

                {manage && !archived ? (
                  <div className="w-44">
                    <MoneyField
                      id={`price_${variant.id}`}
                      aria-label={`Price for ${variant.name}`}
                      placeholder={formatMoney(product.price_pesewas).replace('GH₵ ', '')}
                      value={form.data.prices[variant.id] ?? ''}
                      onChange={(e) => form.setData('prices', { ...form.data.prices, [variant.id]: e.target.value })}
                      error={errors[`price_${variant.id}`]}
                    />
                  </div>
                ) : (
                  <p className="font-medium tabular-nums">{formatMoney(variant.selling_price_pesewas)}</p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
