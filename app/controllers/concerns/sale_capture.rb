# What the "record a sale" screen needs, shared by the live screen and the
# new-order page so both offer exactly the same products and buyers.
module SaleCapture
  extend ActiveSupport::Concern

  private
    # Everything she could sell right now, with live stock counts.
    def sellable_products
      Product.active.ordered.includes(:variants, photos: { image_attachment: :blob }).map { |product|
        {
          id: product.id,
          name: product.name,
          thumb_url: product.photos.first && rails_representation_path(product.photos.first.image.variant(:thumb)),
          variants: product.variants.map { |variant|
            {
              id: variant.id,
              name: variant.name,
              option_values: variant.option_values,
              stock: variant.stock_on_hand,
              price_pesewas: variant.selling_price_pesewas
            }
          }
        }
      }
    end

    # Buyers she already knows, most recent first, for the suggestions under
    # the buyer box. Capped: beyond this, typing the name still works.
    def known_buyers
      Customer.order(updated_at: :desc).limit(500).map { |customer|
        { id: customer.id, handle: customer.handle, name: customer.name, phone: customer.phone }
      }
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
        units: order.items.sum(&:quantity),
        at: order.created_at.strftime("%-d %b, %-l:%M %P"),
        channel: order.sales_channel&.name, # "WhatsApp"; nil if not recorded
        items: order.items.sort_by(&:id).map { |item|
          { id: item.id, name: item.variant.full_name, quantity: item.quantity, total_pesewas: item.total_pesewas }
        }
      }
    end
end
