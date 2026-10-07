import { Head, Link, router } from '@inertiajs/react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'

type CategoryRow = { id: number; name: string; active: boolean; products_count: number }

const arrow =
  'flex size-10 items-center justify-center rounded-md text-taupe-700 hover:bg-taupe-100 hover:text-wine-800 focus-visible:outline-2 focus-visible:outline-wine-700 disabled:opacity-30 disabled:hover:bg-transparent'

// Props from Settings::CategoriesController#index
export default function CategoriesIndex({
  categories,
  uncategorised_count,
}: {
  categories: CategoryRow[]
  uncategorised_count: number
}) {
  const products = (count: number) => (count === 1 ? '1 product' : `${count} products`)

  // -> Settings::CategoriesController#move. preserveScroll keeps the page
  // where it is, so she can tap an arrow several times in a row.
  const move = (category: CategoryRow, direction: 'up' | 'down') =>
    router.patch(`/admin/settings/categories/${category.id}/move`, { direction }, { preserveScroll: true })

  return (
    <SettingsLayout>
      <Head title="Categories" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-taupe-700">
          The kinds of things you sell. Each product can sit in one category, which you can then filter your product
          list by. They show in this order.
        </p>
        <ButtonLink href="/admin/settings/categories/new">
          <Plus className="size-5" aria-hidden="true" />
          Add a category
        </ButtonLink>
      </div>

      <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
        {categories.map((category, index) => (
          <li key={category.id} className="flex items-center gap-1 pr-2">
            <Link
              href={`/admin/settings/categories/${category.id}/edit`}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
            >
              <span className={`font-medium ${category.active ? '' : 'text-taupe-600'}`}>{category.name}</span>
              {!category.active && <Badge tone="muted">Hidden</Badge>}
              <span className="ml-auto text-sm text-taupe-700 tabular-nums">{products(category.products_count)}</span>
            </Link>
            <button
              type="button"
              className={arrow}
              onClick={() => move(category, 'up')}
              disabled={index === 0}
              aria-label={`Move ${category.name} up`}
            >
              <ArrowUp className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={arrow}
              onClick={() => move(category, 'down')}
              disabled={index === categories.length - 1}
              aria-label={`Move ${category.name} down`}
            >
              <ArrowDown className="size-5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {uncategorised_count > 0 && (
        <p className="mt-3 text-sm text-taupe-700">
          {products(uncategorised_count)} {uncategorised_count === 1 ? 'has' : 'have'} no category yet.{' '}
          <Link href="/admin/products?category=none" className="font-medium text-wine-800 underline underline-offset-4">
            See {uncategorised_count === 1 ? 'it' : 'them'}
          </Link>
        </p>
      )}
    </SettingsLayout>
  )
}
