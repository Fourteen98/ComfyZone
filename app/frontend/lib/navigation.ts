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
  /** A count to show as a badge beside the label, from the `alerts` Rails
      shares with every page (InertiaController). `says` words it for
      screen readers: "3 to pack". */
  alert?: { key: 'low_stock' | 'to_pack'; says: string }
}

// The app's sections, in one place. The sidebar and the phone bottom bar both
// read this list, so adding a section later is a one-line change here.
export const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, ready: true, mobile: true },
  { label: 'Products', href: '/admin/products', icon: Shirt, ready: true, mobile: true, permissions: ['products.view'] },
  { label: 'Purchases', href: '/admin/purchases', icon: Truck, ready: true, permissions: ['purchases.view'] },
  { label: 'Suppliers', href: '/admin/suppliers', icon: Store, ready: true, permissions: ['purchases.view'] },
  {
    label: 'Stock',
    href: '/admin/stock',
    icon: Boxes,
    ready: true,
    permissions: ['stock.view'],
    alert: { key: 'low_stock', says: 'low or out' },
  },
  { label: 'Live sales', href: '/admin/live', icon: Radio, ready: true, mobile: true, permissions: ['orders.view'] },
  {
    label: 'Orders',
    href: '/admin/orders',
    icon: ReceiptText,
    ready: true,
    mobile: true,
    permissions: ['orders.view'],
    alert: { key: 'to_pack', says: 'to pack' },
  },
  { label: 'Customers', href: '/admin/customers', icon: Users, ready: true, permissions: ['customers.view'] },
  { label: 'Expenses', href: '/admin/expenses', icon: Wallet, ready: true, permissions: ['expenses.view'] },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3, ready: true, permissions: ['reports.view'] },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    ready: true,
    permissions: ['settings.manage', 'users.manage', 'roles.manage'],
  },
]
