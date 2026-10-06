import { usePage } from '@inertiajs/react'

// Ask "may the current person do this?" from any component:
//
//   const can = useCan()
//   {can('products.manage') && <Button>Add product</Button>}
//
// This only decides what to SHOW. Rails checks the same permission again in
// the controller (`require_permission`), and that check is the one that
// actually protects anything.
export function useCan() {
  const { permissions } = usePage().props.auth
  return (key: string) => permissions.includes(key)
}
