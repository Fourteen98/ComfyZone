import { Head } from '@inertiajs/react'
import AppLayout from '@/layouts/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import SupplierForm from '@/components/SupplierForm'
import type { SupplierFormProps } from '@/components/SupplierForm'

// Props from SuppliersController#new / #edit. The form is a component, so
// the drawer on the suppliers list can use the very same one.
export default function SupplierFormPage(props: SupplierFormProps) {
  const title = props.supplier ? `Edit ${props.supplier.name}` : 'Add a supplier'
  return (
    <AppLayout>
      <Head title={title} />
      <PageHeader title={title} />
      <SupplierForm {...props} />
    </AppLayout>
  )
}
