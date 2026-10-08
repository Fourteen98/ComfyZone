class PurchasesController < InertiaController
  include LocationPicker
  require_permission "purchases.view", only: %i[ index show ]
  require_permission "purchases.manage", except: %i[ index show ]

  before_action :set_purchase, only: %i[ show edit update destroy receive ]

  # GET /purchases?status=ordered
  def index
    purchases = Purchase.newest_first.includes(:supplier, :items)
    purchases = purchases.ordered if params[:status] == "ordered"

    render inertia: "Purchases/Index", props: {
      purchases: purchases.limit(200).map { |purchase| list_props(purchase) },
      filters: { status: params[:status] == "ordered" ? "ordered" : "all" },
      counts: { all: Purchase.count, ordered: Purchase.ordered.count }
    }
  end

  # GET /purchases/:id
  def show
    render inertia: "Purchases/Show", props: { purchase: detail_props(@purchase) }
  end

  # GET /purchases/new
  def new
    render inertia: "Purchases/Form", props: form_page_props(nil)
  end

  # POST /purchases
  def create
    purchase = Purchase.new(purchase_params.merge(user: Current.user))
    purchase.supplier = chosen_supplier

    if save(purchase)
      finish(purchase, created: true)
    else
      redirect_to new_purchase_path, inertia: { errors: form_errors(purchase) }
    end
  end

  # GET /purchases/:id/edit
  def edit
    render inertia: "Purchases/Form", props: form_page_props(@purchase)
  end

  # PATCH /purchases/:id
  def update
    @purchase.assign_attributes(purchase_params)
    @purchase.supplier = chosen_supplier

    # A purchase already in stock is corrected (stock follows the
    # difference); one still on the way is simply saved.
    saved = @purchase.received? ? @purchase.revise!(item_params, by: Current.user) : save(@purchase)

    if saved && @purchase.received?
      redirect_to purchase_path(@purchase), notice: "Saved. Stock has been corrected to match."
    elsif saved
      finish(@purchase, created: false)
    else
      redirect_to edit_purchase_path(@purchase), inertia: { errors: form_errors(@purchase) }
    end
  end

  # PATCH /purchases/:id/receive
  def receive
    @purchase.receive!(by: Current.user)
    redirect_to purchase_path(@purchase), notice: "Added #{units(@purchase)} to stock."
  rescue Purchase::AlreadyReceived
    redirect_to purchase_path(@purchase), alert: "This purchase was already received. Stock was not added twice."
  end

  # DELETE /purchases/:id
  #
  # On the way: purchases.manage is enough (no stock was touched).
  # Already in stock: needs purchases.delete as well, and takes the stock out.
  def destroy
    if @purchase.received? && !can?("purchases.delete")
      return redirect_to purchase_path(@purchase), status: :see_other,
        alert: "Deleting a purchase that is already in stock needs the \"Delete purchases\" permission. Ask an Owner."
    end

    received = @purchase.received?
    if @purchase.remove!(by: Current.user)
      redirect_to purchases_path, status: :see_other,
        notice: received ? "Purchase deleted, and its items taken back out of stock." : "Purchase deleted."
    else
      redirect_to purchase_path(@purchase), alert: @purchase.errors.full_messages.to_sentence, status: :see_other
    end
  end

  private
    def set_purchase
      @purchase = Purchase.find(params.expect(:id))
    end

    def purchase_params
      params.expect(purchase: [ :purchased_on, :reference, :delivery_method, :transport_cost, :extra_costs, :note, :currency, :exchange_rate ])
    end

    # The form either picks an existing supplier (supplier_id) or fills in a
    # new one (new_supplier: { name, phone }). A new one is only built here;
    # it is saved together with the purchase, or not at all.
    def chosen_supplier
      fields = params.fetch(:purchase, {}).permit(:supplier_id, new_supplier: %i[ name phone country region place ])

      if fields[:new_supplier].present?
        supplier = Supplier.new(fields[:new_supplier].slice(:name, :phone))
        # Where they are, if she said. (Goods bought abroad: say which country.)
        supplier.locate(**fields[:new_supplier].slice(:country, :region, :place).to_h.symbolize_keys.reverse_merge(country: nil, region: nil, place: nil))
        supplier
      else
        Supplier.find_by(id: fields[:supplier_id])
      end
    end

    # A new supplier is saved by Rails as part of saving the purchase
    # (belongs_to saves a new associated record first, inside the same
    # transaction). So if the purchase is invalid, the supplier is not left
    # behind on its own; and if the supplier is invalid, nothing is saved.
    def save(purchase)
      purchase.save_with_items(item_params)
    end

    # The purchase's errors, with a new supplier's problems moved under the
    # names of the form fields they belong to.
    def form_errors(purchase)
      errors = purchase.errors.to_hash
      supplier = purchase.supplier

      if supplier&.new_record? && supplier.errors.any?
        errors.delete(:supplier) # Rails' generic "Supplier is invalid"
        errors[:new_supplier_name] = supplier.errors[:name] if supplier.errors[:name].any?
        errors[:new_supplier_phone] = supplier.errors[:phone] if supplier.errors[:phone].any?
      end

      errors
    end

    def item_params
      params.fetch(:purchase, {}).permit(items: %i[ variant_id quantity unit_cost ]).fetch(:items, [])
    end

    # The form has two buttons. "Save and add to stock" sends receive=true.
    def finish(purchase, created:)
      if ActiveModel::Type::Boolean.new.cast(params[:receive])
        purchase.receive!(by: Current.user)
        redirect_to purchase_path(purchase), notice: "Saved, and added #{units(purchase)} to stock."
      else
        redirect_to purchase_path(purchase),
          notice: created ? "Saved. Mark it as arrived when the goods come in." : "Saved your changes."
      end
    end

    def units(purchase)
      "#{purchase.units} #{'item'.pluralize(purchase.units)}"
    end

    # --- props ---

    def list_props(purchase)
      {
        id: purchase.id,
        purchased_on: purchase.purchased_on.strftime("%-d %b %Y"),
        supplier: purchase.supplier&.name,
        supplier_phone: purchase.supplier&.phone,
        supplier_where: purchase.supplier&.where_text,
        delivery_method: purchase.delivery_method,
        reference: purchase.reference,
        status: purchase.status,
        units: purchase.units,
        total_pesewas: purchase.total_pesewas,
        currency: purchase.currency
      }
    end

    def detail_props(purchase)
      items = purchase.items.includes(variant: :product).sort_by { |item| [ item.variant.product.name.downcase, item.variant.position ] }

      list_props(purchase).merge(
        note: purchase.note,
        recorded_by: purchase.user.name,
        received_at: purchase.received_at&.strftime("%-d %b %Y"),
        goods_total_pesewas: purchase.goods_total_pesewas,
        transport_cost_pesewas: purchase.transport_cost_pesewas,
        extra_costs_pesewas: purchase.extra_costs_pesewas,
        # Only for a purchase paid in another currency.
        foreign: purchase.foreign? ? {
          code: purchase.currency,
          symbol: Currency.symbol(purchase.currency),
          rate: purchase.exchange_rate_text,
          goods_total_minor: purchase.foreign_goods_total_minor
        } : nil,
        items: items.map { |item|
          {
            id: item.id,
            product_id: item.variant.product_id,
            product: item.variant.product.name,
            variant: item.variant.name,
            option_values: item.variant.option_values,
            quantity: item.quantity,
            unit_cost_pesewas: item.unit_cost_pesewas,
            foreign_unit_cost_minor: item.foreign_unit_cost_minor,
            landed_unit_cost_pesewas: item.landed_unit_cost_pesewas,
            line_total_pesewas: item.goods_total_pesewas
          }
        }
      )
    end

    def form_page_props(purchase)
      {
        purchase: purchase && {
          id: purchase.id,
          received: purchase.received?, # saving then corrects stock
          purchased_on: purchase.purchased_on.iso8601,
          supplier_id: purchase.supplier_id,
          reference: purchase.reference.to_s,
          delivery_method: purchase.delivery_method,
          transport_cost: purchase.transport_cost_pesewas.zero? ? "" : purchase.transport_cost,
          extra_costs: purchase.extra_costs_pesewas.zero? ? "" : purchase.extra_costs,
          note: purchase.note.to_s,
          currency: purchase.currency,
          exchange_rate: purchase.exchange_rate_text.to_s,
          # In the purchase's own currency, as she typed them.
          items: purchase.items.map { |item|
            { variant_id: item.variant_id, quantity: item.quantity,
              unit_cost: purchase.foreign? ? item.foreign_unit_cost : item.unit_cost }
          }
        },
        currencies: Currency.options,
        today: Date.current.iso8601,
        # product_ids lets the form offer a supplier's own products first.
        suppliers: Supplier.ordered.includes(:product_suppliers).map { |supplier|
          { id: supplier.id, name: supplier.name, phone: supplier.phone,
            product_ids: supplier.product_suppliers.map(&:product_id) }
        },
        # Set when arriving from a supplier's page ("Record a purchase from them").
        preselected_supplier_id: Supplier.find_by(id: params[:supplier_id])&.id,
        products: pickable_products,
        locations: location_options # for a new supplier's country, region and place
      }
    end

    # Everything she could be restocking, for the product picker.
    # Loaded up front so searching and adding is instant with no round trips.
    def pickable_products
      last_costs = last_unit_costs

      Product.active.ordered.includes(:variants, photos: { image_attachment: :blob }).map { |product|
        {
          id: product.id,
          name: product.name,
          thumb_url: product.photos.first && rails_representation_path(product.photos.first.image.variant(:thumb)),
          last_cost: Pesewas.to_input(last_costs[product.id]),
          variants: product.variants.map { |variant|
            { id: variant.id, name: variant.name, option_values: variant.option_values, stock: variant.stock_on_hand }
          }
        }
      }
    end

    # { product_id => what one cost on the most recent purchase }
    # One query; the first row seen per product is the newest.
    def last_unit_costs
      PurchaseItem.joins(:purchase, :variant)
        .order("purchases.purchased_on DESC, purchase_items.id DESC")
        .pluck("variants.product_id", :unit_cost_pesewas)
        .each_with_object({}) { |(product_id, cost), found| found[product_id] ||= cost }
    end
end
