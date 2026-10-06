# The stock page: what is on hand right now, and each item's history.
# (Changing stock by hand is Stock::AdjustmentsController.)
class StockController < InertiaController
  require_permission "stock.view"

  # GET /stock?show=low&q=dress
  def index
    variants = Variant.active.joins(:product).merge(Product.active)
      .includes(product: { photos: { image_attachment: :blob } })
      .order("lower(products.name), variants.position")
    variants = variants.where("products.name ILIKE ?", "%#{Product.sanitize_sql_like(params[:q].strip)}%") if params[:q].present?

    all = variants.to_a
    show = %w[ low out ].include?(params[:show]) ? params[:show] : "all"
    shown = case show
    when "low" then all.select { |variant| variant.stock_level == :low }
    when "out" then all.select { |variant| variant.stock_level == :out }
    else all
    end

    render inertia: "Stock/Index", props: {
      # Grouped by product for display: [{ product..., variants: [...] }, ...]
      groups: shown.group_by(&:product).map { |product, list| group_props(product, list) },
      filters: { show: show, q: params[:q].to_s },
      counts: {
        all: all.size,
        low: all.count { |variant| variant.stock_level == :low },
        out: all.count { |variant| variant.stock_level == :out }
      },
      totals: {
        units: all.sum { |variant| [ variant.stock_on_hand, 0 ].max },
        # nil for people who may not see costs; the number never leaves the server.
        value_pesewas: can?("costs.view") ? all.sum(&:stock_value_pesewas) : nil
      }
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
      can_adjust: can?("stock.adjust")
    }
  end

  private
    def group_props(product, variants)
      {
        id: product.id,
        name: product.name,
        low_stock_at: product.low_stock_at,
        thumb_url: product.photos.first && rails_representation_path(product.photos.first.image.variant(:thumb)),
        variants: variants.map { |variant|
          {
            id: variant.id,
            name: variant.name,
            option_values: variant.option_values,
            stock: variant.stock_on_hand,
            level: variant.stock_level,
            value_pesewas: can?("costs.view") ? variant.stock_value_pesewas : nil
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
