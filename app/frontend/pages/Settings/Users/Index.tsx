import { Head, Link } from '@inertiajs/react'
import { UserPlus } from 'lucide-react'
import SettingsLayout from '@/layouts/SettingsLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'

type TeamMember = {
  id: number
  name: string
  email_address: string
  active: boolean
  role: { id: number; name: string }
  is_you: boolean
}

// Props from Settings::UsersController#index
export default function UsersIndex({ users }: { users: TeamMember[] }) {
  return (
    <SettingsLayout>
      <Head title="Team" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-taupe-700">
          Everyone who can log in. A person's role decides what they can see and do.
        </p>
        <ButtonLink href="/settings/users/new">
          <UserPlus className="size-5" aria-hidden="true" />
          Add a person
        </ButtonLink>
      </div>

      <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
        {users.map((user) => (
          <li key={user.id}>
            {/* The whole row is the link, so it is easy to hit on a phone. */}
            <Link
              href={`/settings/users/${user.id}/edit`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium ${user.active ? '' : 'text-taupe-600'}`}>
                  {user.name}
                  {user.is_you && <span className="font-normal text-taupe-600"> (you)</span>}
                </p>
                <p className="truncate text-sm text-taupe-700">{user.email_address}</p>
              </div>
              <div className="flex items-center gap-2">
                {!user.active && <Badge tone="muted">Access off</Badge>}
                <Badge tone={user.role.name === 'Owner' ? 'brand' : 'neutral'}>{user.role.name}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </SettingsLayout>
  )
}
