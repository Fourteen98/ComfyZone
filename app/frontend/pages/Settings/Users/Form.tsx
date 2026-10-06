import { Head, useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Alert from '@/components/ui/Alert'
import Button, { ButtonLink } from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import SelectField from '@/components/ui/SelectField'
import TextField from '@/components/ui/TextField'

type RoleOption = { id: number; name: string; description: string | null }

type Props = {
  // null when adding someone new; the person when editing.
  user: {
    id: number
    name: string
    email_address: string
    active: boolean
    role: { id: number; name: string }
    is_you: boolean
  } | null
  roles: RoleOption[]
}

// One component for both "add" and "edit". Rails decides which by sending
// `user: nil` (new) or the person's details (edit).
export default function UserForm({ user, roles }: Props) {
  const editing = user !== null

  const form = useForm({
    name: user?.name ?? '',
    email_address: user?.email_address ?? '',
    role_id: user ? String(user.role.id) : '',
    password: '',
    active: user?.active ?? true,
  })

  function submit(event: FormEvent) {
    event.preventDefault()

    // Rails expects the fields nested under "user" (see `user_params` in the
    // controller), so wrap them just before sending.
    form.transform((data) => ({ user: data }))

    if (editing) {
      form.patch(`/settings/users/${user.id}`) // -> Settings::UsersController#update
    } else {
      form.post('/settings/users') // -> Settings::UsersController#create
    }
  }

  const chosenRole = roles.find((role) => String(role.id) === form.data.role_id)
  // `base` holds errors that belong to the record as a whole, not one field.
  const errors = form.errors as Record<string, string[] | undefined>

  return (
    <SettingsLayout>
      <Head title={editing ? `Edit ${user.name}` : 'Add a person'} />

      <form onSubmit={submit} className="max-w-xl space-y-5">
        <h2 className="font-display text-3xl font-semibold text-wine-800">
          {editing ? `Edit ${user.name}` : 'Add a person'}
        </h2>

        {errors.base && <Alert tone="error">{errors.base[0]}</Alert>}

        <TextField
          id="name"
          label="Name"
          required
          autoFocus={!editing}
          value={form.data.name}
          onChange={(e) => form.setData('name', e.target.value)}
          error={errors.name}
        />

        <TextField
          id="email_address"
          label="Email"
          type="email"
          required
          autoComplete="off"
          value={form.data.email_address}
          onChange={(e) => form.setData('email_address', e.target.value)}
          error={errors.email_address}
        />

        <SelectField
          id="role_id"
          label="Role"
          required
          placeholder="Choose a role"
          options={roles.map((role) => ({ value: role.id, label: role.name }))}
          value={form.data.role_id}
          onChange={(e) => form.setData('role_id', e.target.value)}
          hint={chosenRole?.description ?? undefined}
          // Rails reports a missing role under "role", a refused change under "role_id".
          error={errors.role_id ?? errors.role}
        />

        <TextField
          id="password"
          label={editing ? 'New password' : 'Password'}
          type="text"
          required={!editing}
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          placeholder={editing ? 'Leave empty to keep the current one' : 'At least 8 characters'}
          value={form.data.password}
          onChange={(e) => form.setData('password', e.target.value)}
          error={errors.password}
        />
        {!editing && (
          <p className="-mt-3 text-sm text-taupe-700">
            Tell them this password yourself. They log in with their email and this password.
          </p>
        )}

        {editing && (
          <div>
            <Checkbox
              label="Can log in"
              description="Untick to switch off their access. Their history is kept."
              checked={form.data.active}
              onChange={(e) => form.setData('active', e.target.checked)}
            />
            {errors.active && <p className="mt-1 px-2 text-sm text-red-800">{errors.active[0]}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={form.processing}>
            {editing ? 'Save changes' : 'Add person'}
          </Button>
          <ButtonLink href="/settings/users" variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </SettingsLayout>
  )
}
