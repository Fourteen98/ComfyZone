import { Head, router } from '@inertiajs/react'
import { ShoppingBag } from 'lucide-react'
import ShopLayout from '@/layouts/ShopLayout'
import { ButtonLink } from '@/components/ui/Button'
import QuantityStepper from '@/components/ui/QuantityStepper'
import BagLine from '@/components/shop/BagLine'
import type { BagLineData } from '@/components/shop/BagLine'
import { formatMoney } from '@/lib/format'

type Props = { cart: { lines: BagLineData[]; total_pesewas: number } }

// Props from Shop::CartController#show
export default function ShopCart({ cart }: Props) {
  const blocked = cart.lines.some((line) => line.short)

  // Each change is saved straight away (-> Shop::CartController#change /
  // #remove), and the page comes back with fresh totals. No "update" button.
  const change = (line: BagLineData, quantity: string) => {
    const number = Number.parseInt(quantity, 10) || 0
    if (number === 0) router.delete(`/cart/items/${line.variant_id}`, { preserveScroll: true })
    else router.patch(`/cart/items/${line.variant_id}`, { quantity: number }, { preserveScroll: true })
  }

  return (
    <ShopLayout>
      <Head title="Your bag" />
      <h1 className="mt-8 font-display text-4xl font-semibold text-wine-800 sm:text-5xl">Your bag</h1>

      {cart.lines.length === 0 ? (
        <div className="py-16 text-center">
          <ShoppingBag className="mx-auto size-12 text-taupe-400" aria-hidden="true" />
          <p className="mt-4 text-lg text-taupe-800">Nothing in here yet.</p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/">See the pieces</ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-taupe-200 border-y border-taupe-200">
            {cart.lines.map((line) => (
              <li key={line.variant_id} className="py-5">
                <BagLine line={line}>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <QuantityStepper
                      label={line.product}
                      value={String(line.quantity)}
                      onChange={(value) => change(line, value)}
                      max={Math.max(line.available, 1)}
                    />
                    <button
                      type="button"
                      onClick={() => router.delete(`/cart/items/${line.variant_id}`, { preserveScroll: true })}
                      className="min-h-11 rounded px-1 text-sm text-taupe-700 underline underline-offset-4 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
                    >
                      Remove
                    </button>
                  </div>
                  {line.short && (
                    <p className="mt-2 text-sm font-medium text-red-800" role="alert">
                      {line.available === 0 ? 'This has just sold out. Please remove it.' : `Only ${line.available} left. Please lower the number.`}
                    </p>
                  )}
                </BagLine>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-baseline justify-between">
            <p className="text-taupe-800">Total</p>
            <p className="text-3xl font-semibold text-wine-800 tabular-nums">{formatMoney(cart.total_pesewas)}</p>
          </div>
          <p className="mt-1 text-right text-sm text-taupe-700">Delivery, if you want it, is added at the next step.</p>

          <div className="mt-6 space-y-3">
            {blocked ? (
              <p className="rounded-xl bg-taupe-100 p-4 text-center text-taupe-800">Fix the items marked above to carry on.</p>
            ) : (
              <ButtonLink href="/checkout" block>
                Checkout
              </ButtonLink>
            )}
            <ButtonLink href="/" variant="secondary" block>
              Keep looking
            </ButtonLink>
          </div>
        </>
      )}
    </ShopLayout>
  )
}
