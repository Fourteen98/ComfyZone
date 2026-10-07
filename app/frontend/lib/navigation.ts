import { BarChart3, Boxes, LayoutDashboard, Radio, ReceiptText, Settings, Shirt, Store, Truck, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** false = the section isn't built yet; shown dimmed and not clickable. */
  ready: boolean
  /** Show in the phone's bottom bar. It has room for four; everything else
      is one tap away under "More". */
  mobile?: boolean
  /** Who sees this item: anyone holding at least one of these permissions.
      Leave out for items everyone sees. */
  permissions?: string[]
}

// The app's sections, in one place. The sidebar and the phone bottom bar both
// read this list, so adding a section later is a one-line change here.
export const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, ready: true, mobile: true },
  { label: 'Products', href: '/products', icon: Shirt, ready: true, mobile: true, permissions: ['products.view'] },
  { label: 'Purchases', href: '/purchases', icon: Truck, ready: true, permissions: ['purchases.view'] },
  { label: 'Suppliers', href: '/suppliers', icon: Store, ready: true, permissions: ['purchases.view'] },
  { label: 'Stock', href: '/stock', icon: Boxes, ready: true, permissions: ['stock.view'] },
  { label: 'Live sales', href: '/live', icon: Radio, ready: true, mobile: true, permissions: ['orders.view'] },
  { label: 'Orders', href: '/orders', icon: ReceiptText, ready: true, mobile: true, permissions: ['orders.view'] },
  { label: 'Customers', href: '/customers', icon: Users, ready: true, permissions: ['customers.view'] },
  { label: 'Expenses', href: '/expenses', icon: Wallet, ready: true, permissions: ['expenses.view'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, ready: true, permissions: ['reports.view'] },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    ready: true,
    permissions: ['settings.manage', 'users.manage', 'roles.manage'],
  },
]
