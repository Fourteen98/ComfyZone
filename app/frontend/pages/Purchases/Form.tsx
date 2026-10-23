import { Head } from '@inertiajs/react'
import AppLayout from '@/layouts/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import PurchaseForm from '@/components/PurchaseForm'
import type { PurchaseFormProps } from '@/components/PurchaseForm'

// Props from PurchasesController#new / #edit. The form itself is a component,
// so the drawer on the purchases list can use the very same one.
export default function PurchaseFormPage(props: PurchaseFormProps) {
  const editing = props.purchase !== null
  return (
    <AppLayout>
      <Head title={editing ? 'Edit purchase' : 'Record a purchase'} />
      <PageHeader title={editing ? 'Edit purchase' : 'Record a purchase'} />
      <PurchaseForm {...props} />
    </AppLayout>
  )
}
