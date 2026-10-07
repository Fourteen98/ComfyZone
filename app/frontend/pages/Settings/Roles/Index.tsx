import { Head, Link } from '@inertiajs/react'
import { Lock, Plus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import { ButtonLink } from '@/components/ui/Button'

type RoleRow = {
  id: number
  name: string
  description: string | null
  system: boolean
  permissions_count: number
  users_count: number
}

// Props from Settings::RolesController#index
export default function RolesIndex({ roles, permissions_total }: { roles: RoleRow[]; permissions_total: number }) {
  const people = (count: number) => (count === 1 ? '1 person' : `${count} people`)

  return (
    <SettingsLayout>
      <Head title="Roles" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-taupe-700">
          A role is a named set of permissions. Give each person the role that matches their job.
        </p>
        <ButtonLink href="/admin/settings/roles/new">
          <Plus className="size-5" aria-hidden="true" />
          Add a role
        </ButtonLink>
      </div>

      <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
        {roles.map((role) => {
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {role.name}
                  {role.system && <Lock className="size-4 text-taupe-500" aria-label="Built in" />}
                </p>
                {role.description && <p className="text-sm text-taupe-700">{role.description}</p>}
              </div>
              <p className="text-sm text-taupe-700 tabular-nums">
                {role.system ? 'All permissions' : `${role.permissions_count} of ${permissions_total} permissions`}
                <span className="mx-2 text-taupe-300" aria-hidden="true">
                  |
                </span>
                {people(role.users_count)}
              </p>
            </>
          )
          const row = 'flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4'

          return (
            <li key={role.id}>
              {role.system ? (
                // The built-in role can't be edited, so it isn't a link.
                <div className={row}>{body}</div>
              ) : (
                <Link
                  href={`/admin/settings/roles/${role.id}/edit`}
                  className={`${row} hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700`}
                >
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </SettingsLayout>
  )
}
