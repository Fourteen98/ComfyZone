import { Head, router, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import TextField from '@/components/ui/TextField'
import { confirmAction } from '@/lib/confirm'

type PermissionGroup = {
  name: string
  permissions: { key: string; label: string }[]
}

type Props = {
  // null when creating; the role when editing.
  role: {
    id: number
    name: string
    description: string | null
    permissions: string[]
    users_count: number
  } | null
  // The full list, straight from app/models/permission.rb.
  permission_groups: PermissionGroup[]
}

export default function RoleForm({ role, permission_groups }: Props) {
  const editing = role !== null

  const form = useForm({
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissions: role?.permissions ?? ([] as string[]),
  })
  const errors = form.errors as Record<string, string[] | undefined>
  const chosen = form.data.permissions

  function toggle(key: string, on: boolean) {
    form.setData('permissions', on ? [...chosen, key] : chosen.filter((k) => k !== key))
  }

  function toggleGroup(group: PermissionGroup, on: boolean) {
    const keys = group.permissions.map((p) => p.key)
    const rest = chosen.filter((k) => !keys.includes(k))
    form.setData('permissions', on ? [...rest, ...keys] : rest)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    // Nest under "role" for `role_params` in the controller. An empty list is
    // sent as [""] so Rails still receives the key and clears the permissions.
    form.transform((data) => ({
      role: { ...data, permissions: data.permissions.length ? data.permissions : [''] },
    }))

    if (editing) {
      form.patch(`/settings/roles/${role.id}`)
    } else {
      form.post('/settings/roles')
    }
  }

  async function destroy() {
    if (!editing) return
    if (!(await confirmAction(`Delete the ${role.name} role? This can't be undone.`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/settings/roles/${role.id}`) // -> Settings::RolesController#destroy
  }

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${role.name}` : 'Add a role'} />

      <form onSubmit={submit} className="space-y-6">
        <h2 className="font-display text-3xl font-semibold text-wine-800">
          {editing ? `Edit the ${role.name} role` : 'Add a role'}
        </h2>

        {errors.base && <Alert tone="error">{errors.base[0]}</Alert>}

        <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
          <TextField
            id="name"
            label="Name"
            required
            maxLength={40}
            autoFocus={!editing}
            value={form.data.name}
            onChange={(e) => form.setData('name', e.target.value)}
            error={errors.name}
          />
          <TextField
            id="description"
            label="What this role is for"
            maxLength={200}
            value={form.data.description}
            onChange={(e) => form.setData('description', e.target.value)}
            error={errors.description}
          />
        </div>

        <div>
          <h3 className="font-medium">What people with this role can do</h3>
          <p className="text-sm text-taupe-700">
            {chosen.length === 0 ? 'Nothing ticked yet.' : `${chosen.length} ticked.`} Some of these control
            sections that are still being built; they take effect as each one arrives.
          </p>
          {errors.permissions && <p className="mt-1 text-sm text-red-800">{errors.permissions[0]}</p>}

          {/* One box per area. Three across on wide screens, one on phones. */}
          <div className="mt-4 grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {permission_groups.map((group) => {
              const keys = group.permissions.map((p) => p.key)
              const all = keys.every((k) => chosen.includes(k))

              return (
                <fieldset key={group.name} className="rounded-lg border border-taupe-200 bg-white p-3">
                  <legend className="sr-only">{group.name}</legend>
                  <div className="flex items-center justify-between px-2 pb-1">
                    <span className="font-display text-xl font-semibold text-wine-800">{group.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group, !all)}
                      className="rounded px-2 py-1.5 text-sm font-medium text-wine-700 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
                    >
                      {all ? 'Clear' : 'Tick all'}
                    </button>
                  </div>
                  {group.permissions.map((permission) => (
                    <Checkbox
                      key={permission.key}
                      label={permission.label}
                      checked={chosen.includes(permission.key)}
                      onChange={(e) => toggle(permission.key, e.target.checked)}
                    />
                  ))}
                </fieldset>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add role'}
          </Button>
          <ButtonLink href="/settings/roles" variant="secondary">
            Cancel
          </ButtonLink>
          {editing && (
            <Button type="button" variant="danger" className="sm:ml-auto" onClick={destroy}>
              Delete role
            </Button>
          )}
        </div>
      </form>
    </SettingsLayout>
  )
}
