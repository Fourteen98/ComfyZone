# What the "record a sale" screen needs, shared by the live screen and the
# new-order page so both offer exactly the same products and buyers.
module SaleCapture
  extend ActiveSupport::Concern
  include LocationPicker # location_options, where_from

  private
    # Everything she could sell right now, with live stock counts.
    def sellable_products
      Product.active.ordered.includes(:variants, photos: { image_attachment: :blob }).map { |product|
        {
          id: product.id,
          name: product.name,
          thumb_url: product.photos.first && rails_representation_path(product.photos.first.image.variant(:thumb)),
          # For the total on screen. Rails works out the real price on save (BulkPricing).
          bulk: product.bulk? ? { price_pesewas: product.bulk_price_pesewas, from: product.bulk_min_quantity } : nil,
          # Counted as one total: each size's `stock` is the product's total,
          # shared between them (see ProductPicker's `left`).
          pooled: product.stock_pooled,
          variants: product.variants.map { |variant|
            {
              id: variant.id,
              name: variant.name,
              option_values: variant.option_values,
              stock: variant.available,
              price_pesewas: variant.selling_price_pesewas
            }
          }
        }
      }
    end

    # Buyers she already knows, most recent first, for the suggestions under
    # the buyer box. Capped: beyond this, typing the name still works.
    def known_buyers
      customers = Customer.includes(:delivery_area).order(updated_at: :desc).limit(500).to_a
      # Do they pay for what they claim? Shown when she picks them.
      reliability = Customer.reliability(customers.map(&:id))
      customers.map { |customer|
        { id: customer.id, handle: customer.handle, name: customer.name, phone: customer.phone,
          location: customer.location, country: customer.country, region: customer.region,
          place: customer.delivery_area&.name, bulk_buyer: customer.bulk_buyer,
          reliability: reliability[customer.id].to_props }
      }
    end

    # "4:30 pm", "tomorrow 9:00 am", "Sat 9:00 am"; "now" once it has passed.
    def pay_by_words(time)
      return "now" if time <= Time.current

      day = time.to_date
      clock = time.strftime("%-l:%M %P")
      day == Date.current ? clock : day == Date.tomorrow ? "tomorrow #{clock}" : "#{time.strftime('%a')} #{clock}"
    end

    # Where a sale can come from, for the pills on the capture screen.
    def sales_channels(scope = SalesChannel.active)
      scope.ordered.map { |channel| { id: channel.id, name: channel.name, kind: channel.kind } }
    end

    def order_summary(order)
      {
        id: order.id,
        customer: order.customer.display_name,
        status: order.status,
        total_pesewas: order.total_pesewas,     # the goods
        due_pesewas: order.due_pesewas,         # goods + delivery
        paid_pesewas: order.paid_pesewas,
        balance_pesewas: order.balance_pesewas, # > 0 they owe her, < 0 she owes them
        units: order.items.sum(&:kept),
        at: order.created_at.strftime("%-d %b, %-l:%M %P"),
        channel: order.sales_channel&.name, # "WhatsApp"; nil if not recorded
        # Unpaid and on the clock (ClaimHold): "Pay by 4:30 pm", for the lists.
        pay_by: ClaimHold.waiting?(order) ? pay_by_words(order.hold_until) : nil,
        items: order.items.sort_by(&:id).map { |item|
          { id: item.id, name: item.variant.full_name, quantity: item.quantity, returned: item.returned_quantity,
            total_pesewas: item.total_pesewas, bulk: item.bulk,
            # A price agreed with the buyer, and what it would normally be.
            agreed: item.agreed, normal_price_pesewas: item.agreed ? item.variant.selling_price_pesewas : nil }
        }
      }
    end
end
