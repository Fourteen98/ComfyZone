class SuppliersController < InertiaController
  include LocationPicker

  require_permission "purchases.view", only: %i[ index show ]
  require_permission "purchases.manage", except: %i[ index show ]
  before_action :set_supplier, only: %i[ show edit update ]

  # GET /suppliers?q=kumasi
  def index
    suppliers = Supplier.ordered.includes(:products)
    if params[:q].present?
      term = "%#{Supplier.sanitize_sql_like(params[:q].strip)}%"
      # Phones are stored as typed ("020 111 2222"), so compare digits only:
      # searching 0201112222 or 111 22 both find it.
      digits = PhoneNumber.search_digits(params[:q])
      phone = digits.length >= 3 ? "%#{digits}%" : nil

      # Find a supplier by their own name, their phone, OR by something they
      # sell: "who do I buy kaftans from?"
      suppliers = suppliers.where(
        "suppliers.name ILIKE :term
         OR suppliers.phone LIKE :phone
         OR suppliers.id IN (
           SELECT supplier_id FROM product_suppliers
           JOIN products ON products.id = product_suppliers.product_id
           WHERE products.name ILIKE :term)",
        term: term, phone: phone
      )
    end

    # Totals for every supplier in grouped queries, not one set per supplier.
    counts = Purchase.group(:supplier_id).count
    goods = PurchaseItem.joins(:purchase).group("purchases.supplier_id").sum("quantity * unit_cost_pesewas")
    added = Purchase.group(:supplier_id).sum("transport_cost_pesewas + extra_costs_pesewas")

    render inertia: "Suppliers/Index", props: {
      suppliers: suppliers.map { |supplier|
        {
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          where: supplier.where_text, # "Guangzhou, China"
          products: supplier.products.sort_by { |product| product.name.downcase }.map(&:name),
          purchases_count: counts.fetch(supplier.id, 0),
          spent_pesewas: goods.fetch(supplier.id, 0) + added.fetch(supplier.id, 0)
        }
      },
      filters: { q: params[:q].to_s },
      total: Supplier.count
    }
  end

  # GET /suppliers/:id
  def show
    purchases = @supplier.purchases.newest_first.includes(:items)
    last_costs = last_costs_from(@supplier)

    render inertia: "Suppliers/Show", props: {
      supplier: {
        id: @supplier.id,
        name: @supplier.name,
        phone: @supplier.phone,
        where: [ @supplier.where_text, @supplier.location ].compact.join(", ").presence,
        abroad: @supplier.abroad?,
        note: @supplier.note,
        purchases_count: purchases.size,
        spent_pesewas: purchases.sum(&:total_pesewas),
        products: @supplier.products.ordered.includes(photos: { image_attachment: :blob }).map { |product|
          {
            id: product.id,
            name: product.name,
            archived: product.archived?,
            thumb_url: product.photos.first && rails_representation_path(product.photos.first.image.variant(:thumb)),
            # nil if she has listed it but never actually bought it from them
            last_cost_pesewas: last_costs[product.id]
          }
        },
        purchases: purchases.first(20).map { |purchase|
          {
            id: purchase.id,
            purchased_on: purchase.purchased_on.strftime("%-d %b %Y"),
            status: purchase.status,
            units: purchase.units,
            total_pesewas: purchase.total_pesewas
          }
        }
      }
    }
  end

  # GET /suppliers/new
  def new
    render inertia: "Suppliers/Form", props: { supplier: nil, products: pickable_products, locations: location_options }
  end

  # POST /suppliers
  def create
    supplier = Supplier.new(supplier_params)
    place(supplier)

    if supplier.save_with_products(product_ids)
      redirect_to supplier_path(supplier), notice: "Added #{supplier.name}."
    else
      redirect_to new_supplier_path, inertia: { errors: supplier.errors }
    end
  end

  # GET /suppliers/:id/edit
  def edit
    render inertia: "Suppliers/Form", props: {
      supplier: {
        id: @supplier.id, name: @supplier.name, phone: @supplier.phone.to_s, note: @supplier.note.to_s,
        location: @supplier.location.to_s, product_ids: @supplier.product_ids, **where_now(@supplier)
      },
      products: pickable_products(also: @supplier.products),
      locations: location_options
    }
  end

  # PATCH /suppliers/:id
  def update
    @supplier.assign_attributes(supplier_params)
    place(@supplier)

    if @supplier.save_with_products(product_ids)
      redirect_to supplier_path(@supplier), notice: "Saved #{@supplier.name}."
    else
      redirect_to edit_supplier_path(@supplier), inertia: { errors: @supplier.errors }
    end
  end

  private
    def set_supplier
      @supplier = Supplier.find(params.expect(:id))
    end

    def supplier_params
      params.expect(supplier: [ :name, :phone, :note, :location ])
    end

    def place(supplier)
      where = where_from(params.fetch(:supplier, {}))
      supplier.relocate(**where) if where
    end

    # nil when the form didn't send the list at all (leave pairings alone);
    # an array, possibly empty, when it did (replace them).
    def product_ids
      list = params.fetch(:supplier, {}).permit(product_ids: [])[:product_ids]
      list&.compact_blank
    end

    # Active products to choose from, plus any archived ones already linked
    # so they don't silently vanish from the supplier when the form is saved.
    def pickable_products(also: [])
      (Product.active.ordered.includes(photos: { image_attachment: :blob }).to_a | also.to_a).map { |product|
        {
          id: product.id,
          name: product.name,
          thumb_url: product.photos.first && rails_representation_path(product.photos.first.image.variant(:thumb))
        }
      }
    end

    # { product_id => unit cost on the most recent purchase from this supplier }
    def last_costs_from(supplier)
      PurchaseItem.joins(:purchase, :variant)
        .where(purchases: { supplier_id: supplier.id })
        .order("purchases.purchased_on DESC, purchase_items.id DESC")
        .pluck("variants.product_id", :unit_cost_pesewas)
        .each_with_object({}) { |(product_id, cost), found| found[product_id] ||= cost }
    end
end
