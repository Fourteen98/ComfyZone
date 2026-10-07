import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Checkbox from '@/components/ui/Checkbox'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import MoneyField from '@/components/ui/MoneyField'
import PageHeader from '@/components/ui/PageHeader'
import SelectField from '@/components/ui/SelectField'
import Panel from '@/components/ui/Panel'
import TextAreaField from '@/components/ui/TextAreaField'
import TextField from '@/components/ui/TextField'
import ProductOptionsEditor from '@/components/ProductOptionsEditor'
import type { Preset } from '@/components/ProductOptionsEditor'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { chosenValues, previewVariantNames } from '@/lib/variants'
import type { DraftOption } from '@/lib/variants'

type Props = {
  // null when adding; the product when editing.
  product: {
    id: number
    name: string
    description: string
    price: string
    category_id: number | null
    low_stock_at: number
    listed: boolean
    options: { name: string; values: OptionValue[] }[]
  } | null
  presets: Preset[]
  categories: { id: number; name: string }[]
}

const MAX_OPTIONS = 3 // matches Product::MAX_OPTIONS in Rails
const PREVIEW_LIMIT = 24

export default function ProductForm({ product, presets, categories }: Props) {
  const editing = product !== null

  const form = useForm({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    category_id: product?.category_id ? String(product.category_id) : '',
    low_stock_at: String(product?.low_stock_at ?? 2),
    // Off for a new product: nothing goes public until she says so.
    listed: product?.listed ?? false,
    // When editing, everything saved starts out ticked.
    options: (product?.options ?? []).map<DraftOption>((option) => ({
      name: option.name,
      choices: option.values,
      selected: option.values.map((value) => value.label),
    })),
  })
  const errors = form.errors as Record<string, string[] | undefined>

  // Change a field and clear its error, so a red message doesn't linger
  // after she has fixed the problem.
  function set(field: 'name' | 'price' | 'description', value: string) {
    form.setData(field, value)
    form.clearErrors(field)
  }

  const names = previewVariantNames(form.data.options)
  const waiting = form.data.options.some((option) => option.selected.length === 0)

  function submit(event: FormEvent) {
    event.preventDefault()
    // Send only what Rails needs: each option's name and its TICKED choices.
    form.transform((data) => ({
      product: {
        name: data.name,
        description: data.description,
        price: data.price,
        category_id: data.category_id, // '' clears it
        low_stock_at: data.low_stock_at,
        listed: data.listed,
        options: data.options.map((option) => ({ name: option.name, values: chosenValues(option) })),
      },
    }))

    if (editing) {
      form.patch(`/admin/products/${product.id}`) // -> ProductsController#update
    } else {
      form.post('/admin/products') // -> ProductsController#create
    }
  }

  return (
    <AppLayout>
      <Head title={editing ? `Edit ${product.name}` : 'Add a product'} />
      <PageHeader title={editing ? `Edit ${product.name}` : 'Add a product'} />

      {/* Two columns on wide screens: the form, and a preview that stays in
          view while she scrolls. One column on phones. */}
      <form onSubmit={submit} className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {errors.base && <Alert tone="error">{errors.base[0]}</Alert>}

          <Panel title="The product">
            <div className="space-y-5">
              <TextField
                id="name"
                label="Name"
                required
                maxLength={80}
                placeholder="e.g. Ankara wrap dress"
                autoFocus={!editing}
                value={form.data.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <MoneyField
                  id="price"
                  label="Selling price"
                  required
                  placeholder="0.00"
                  value={form.data.price}
                  onChange={(e) => set('price', e.target.value)}
                  hint="You can give a size or colour its own price after saving."
                  error={errors.price}
                />
                <SelectField
                  id="category_id"
                  label="Category"
                  placeholder="No category"
                  options={categories.map((category) => ({ value: category.id, label: category.name }))}
                  value={form.data.category_id}
                  onChange={(e) => form.setData('category_id', e.target.value)}
                  hint={categories.length === 0 ? 'Add categories in Settings, then pick one here.' : undefined}
                  error={errors.category_id ?? errors.category}
                />
              </div>
              <div className="max-w-xs">
                <TextField
                  id="low_stock_at"
                  label="Warn me when stock drops to"
                  inputMode="numeric"
                  value={form.data.low_stock_at}
                  onChange={(e) => {
                    form.setData('low_stock_at', e.target.value.replace(/\D/g, '').slice(0, 5))
                    form.clearErrors('low_stock_at')
                  }}
                  error={errors.low_stock_at}
                />
                <p className="mt-1.5 text-sm text-taupe-700">
                  For each size and colour. Use a higher number for fast sellers, or 0 for no warning.
                </p>
              </div>
              <TextAreaField
                id="description"
                label="Description (optional)"
                maxLength={1000}
                placeholder="Fabric, fit, anything you say about it on a live."
                value={form.data.description}
                onChange={(e) => set('description', e.target.value)}
                error={errors.description}
              />
              <Checkbox
                label="Show on the shop"
                description="Anyone can see it and order it at comfyzone.shop. Add a photo first: it is what people see."
                checked={form.data.listed}
                onChange={(e) => form.setData('listed', e.target.checked)}
              />
            </div>
          </Panel>

          <Panel title="Sizes, colours and other options">
            <p className="mb-4 text-taupe-700">
              Does it come in different sizes, colours or lengths? Add each one as an option. If it is a single item
              with no choices, skip this.
            </p>
            <ProductOptionsEditor
              options={form.data.options}
              onChange={(options) => {
                form.setData('options', options)
                form.clearErrors('options')
              }}
              presets={presets}
              maxOptions={MAX_OPTIONS}
              error={errors.options}
            />
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6">
          <Panel title="What you'll be able to sell">
            {form.data.options.length === 0 ? (
              <p className="text-taupe-700">One item, with no sizes or colours to choose between.</p>
            ) : waiting ? (
              <p className="text-taupe-700">Tick at least one choice in each option to see the variants.</p>
            ) : (
              <>
                <p>
                  <span className="font-display text-4xl font-semibold text-wine-800 tabular-nums">{names.length}</span>{' '}
                  {names.length === 1 ? 'variant' : 'variants'}
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {names.slice(0, PREVIEW_LIMIT).map((name) => (
                    <li key={name} className="rounded-md border border-taupe-200 bg-taupe-50 px-2 py-0.5 text-sm">
                      {name}
                    </li>
                  ))}
                </ul>
                {names.length > PREVIEW_LIMIT && (
                  <p className="mt-2 text-sm text-taupe-700">and {names.length - PREVIEW_LIMIT} more</p>
                )}
                {editing && (
                  <p className="mt-4 border-t border-taupe-200 pt-3 text-sm text-taupe-700">
                    Variants you keep hold on to their prices. Ones you untick are removed.
                  </p>
                )}
              </>
            )}
          </Panel>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={form.processing}>
              {editing ? 'Save changes' : 'Add product'}
            </Button>
            <ButtonLink href={editing ? `/admin/products/${product.id}` : '/admin/products'} variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}
