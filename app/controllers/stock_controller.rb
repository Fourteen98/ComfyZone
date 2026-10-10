# The stock page: what is on hand right now, and each item's history.
# (Changing stock by hand is Stock::AdjustmentsController.)
class StockController < InertiaController
  include SaleCapture # known_buyers, for adding someone to the waiting list
  require_permission "stock.view"

  # GET /stock?show=low&q=dress
  def index
    variants = Variant.active.joins(:product).merge(Product.active)
      .includes(product: { photos: { image_attachment: :blob } })
      .order("lower(products.name), variants.position")
    # "orange 3xl": find that size and colour, best match first (see VariantSearch).
    search = VariantSearch.new(params[:q])
    all = search.blank? ? variants.to_a : search.rank(variants.to_a)
    uncosted = can?("costs.view") ? all.select { |variant| variant.stock_on_hand.positive? && variant.average_cost_pesewas.zero? } : []
    show = %w[ low out ].include?(params[:show]) || (params[:show] == "uncosted" && uncosted.any?) ? params[:show] : "all"
    shown = case show
    when "low" then all.select { |variant| variant.stock_level == :low }
    when "out" then all.select { |variant| variant.stock_level == :out }
    when "uncosted" then uncosted
    else all
    end

    render inertia: "Stock/Index", props: {
      # Grouped by product for display: [{ product..., variants: [...] }, ...]
      groups: shown.group_by(&:product).map { |product, list| group_props(product, list) },
      filters: { show: show, q: params[:q].to_s },
      # While searching, the best match: its quick "add stock" form opens by itself.
      focus_id: search.blank? ? nil : shown.first&.id,
      counts: {
        all: all.size,
        low: all.count { |variant| variant.stock_level == :low },
        out: all.count { |variant| variant.stock_level == :out },
        # In stock with no cost recorded, so worth GH₵ 0 in the total below.
        # nil for people who may not see costs.
        uncosted: can?("costs.view") ? uncosted.size : nil
      },
      totals: {
        units: all.sum { |variant| [ variant.stock_on_hand, 0 ].max },
        # nil for people who may not see costs; the number never leaves the server.
        value_pesewas: can?("costs.view") ? all.sum(&:stock_value_pesewas) : nil
      },
      estimate: estimate_props(StockLedger.sales_estimate)
    }
  end

  # GET /stock/:id   (:id is a variant)
  def show
    variant = Variant.includes(:product).find(params.expect(:id))
    movements = variant.stock_movements.newest_first.includes(:user, :source).limit(200)

    render inertia: "Stock/Show", props: {
      variant: {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        active: variant.active,
        option_values: variant.option_values,
        stock: variant.stock_on_hand,
        level: variant.stock_level,
        low_stock_at: variant.product.low_stock_at,
        average_cost_pesewas: can?("costs.view") ? variant.average_cost_pesewas : nil,
        product: { id: variant.product.id, name: variant.product.name }
      },
      movements: movements.map { |movement| movement_props(movement) },
      movements_total: variant.stock_movements.count,
      can_adjust: can?("stock.adjust"),
      can_set_cost: can?("stock.adjust") && can?("costs.view"),
      # Who asked for this while it was sold out (StockRequest).
      waiting: can?("customers.view") ? variant.stock_requests.open.includes(:customer).order(:created_at).map { |request|
        { id: request.id, customer_id: request.customer_id, customer: request.customer.display_name, phone: request.customer.phone,
          quantity: request.quantity, since: request.created_at.strftime("%-d %b"), told: request.told_at.present?, message: request.message }
      } : nil,
      buyers: can?("customers.manage") ? known_buyers : nil,
      # How many other sizes/colours of this product also have no cost yet.
      siblings_without_cost: can?("costs.view") ? variant.product.variants.where(average_cost_pesewas: 0).where.not(id: variant.id).count : 0
    }
  end

  private
    # If it all sells. Profit only for people who may see costs.
    def estimate_props(estimate)
      costs = can?("costs.view")
      {
        sells_for_pesewas: estimate.sells_for_pesewas,
        profit_pesewas: costs ? estimate.profit_pesewas : nil,
        bulk: estimate.bulk_differs? ? {
          sells_for_pesewas: estimate.bulk_sells_for_pesewas,
          profit_pesewas: costs ? estimate.bulk_profit_pesewas : nil
        } : nil
      }
    end

    def group_props(product, variants)
      {
        id: product.id,
        name: product.name,
        # What this product's stock should sell for (the pieces listed here).
        sells_for_pesewas: variants.sum { |variant| [ variant.stock_on_hand, 0 ].max * variant.selling_price_pesewas },
        low_stock_at: product.low_stock_at,
        thumb_url: product.photos.first && rails_representation_path(product.photos.first.image.variant(:thumb)),
        variants: variants.map { |variant|
          {
            id: variant.id,
            name: variant.name,
            option_values: variant.option_values,
            stock: variant.stock_on_hand,
            level: variant.stock_level,
            value_pesewas: can?("costs.view") ? variant.stock_value_pesewas : nil,
            no_cost: can?("costs.view") && variant.stock_on_hand.positive? && variant.average_cost_pesewas.zero?
          }
        }
      }
    end

    def movement_props(movement)
      {
        id: movement.id,
        at: movement.created_at.strftime("%-d %b %Y, %-l:%M %P"),
        quantity: movement.quantity,
        balance_after: movement.balance_after,
        reason: movement.reason,
        note: movement.note,
        by: movement.user&.name,
        # Where it came from, if it has a page of its own to link to.
        source: source_link(movement.source)
      }
    end

    def source_link(source)
      case source
      when Purchase then { label: "Purchase", href: purchase_path(source) } if can?("purchases.view")
      when Order    then { label: "Order #{source.id}", href: order_path(source) } if can?("orders.view")
      end
    end
end
