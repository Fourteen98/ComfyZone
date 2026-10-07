import { Head, router, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'

type Props = {
  // null when adding; the category when editing.
  category: { id: number; name: string; active: boolean; products_count: number } | null
}

export default function CategoryForm({ category }: Props) {
  const editing = category !== null

  const form = useForm({
    name: category?.name ?? '',
    active: category?.active ?? true,
  })
  const errors = form.errors as Record<string, string[] | undefined>

  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({ category: data }))

    if (editing) {
      form.patch(`/admin/settings/categories/${category.id}`)
    } else {
      form.post('/admin/settings/categories')
    }
  }

  async function destroy() {
    if (!editing) return
    const kept =
      category.products_count === 0
        ? ''
        : category.products_count === 1
          ? ' Its 1 product is kept, with no category.'
          : ` Its ${category.products_count} products are kept, with no category.`
    if (!(await confirmAction(`Delete "${category.name}"?${kept}`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/admin/settings/categories/${category.id}`)
  }

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${category.name}` : 'Add a category'} />

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <h2 className="font-display text-3xl font-semibold text-wine-800">
          {editing ? `Edit ${category.name}` : 'Add a category'}
        </h2>

        <TextField
          id="name"
          label="Name"
          required
          maxLength={40}
          placeholder="e.g. Dresses"
          autoFocus={!editing}
          value={form.data.name}
          onChange={(e) => form.setData('name', e.target.value)}
          error={errors.name}
        />

        {editing && (
          <Checkbox
            label="Offer this when adding products"
            description="Untick to hide it without deleting. Products already in it stay there."
            checked={form.data.active}
            onChange={(e) => form.setData('active', e.target.checked)}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add category'}
          </Button>
          <ButtonLink href="/admin/settings/categories" variant="secondary">
            Cancel
          </ButtonLink>
          {editing && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete category
            </Button>
          )}
        </div>
      </form>
    </SettingsLayout>
  )
}
