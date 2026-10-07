class ProductsController < InertiaController
  # Two levels of access: anyone with products.view can look; changing
  # anything needs products.manage.
  require_permission "products.view", only: %i[ index show ]
  require_permission "products.manage", except: %i[ index show ]

  before_action :set_product, only: %i[ show edit update archive restore listing ]

  # GET /products?q=dress&status=archived
  def index
    status = params[:status] == "archived" ? :archived : :active

    # Scopes chain: each one narrows the query, and nothing hits the
    # database until the results are actually used.
    products = Product.where(status: status).ordered
    products = products.search(params[:q]) if params[:q].present?
    # ?category=dresses narrows to one category; ?category=none to products without one.
    if params[:category] == "none"
      products = products.where(category_id: nil)
    elsif params[:category].present?
      products = products.where(category: Category.find_by(slug: params[:category]))
    end
    # `includes` loads all the variants in ONE extra query, instead of one
    # query per product (the N+1 problem).
    # ...and the same for photos, their attachments and file records.
    products = products.includes(:category, :variants, photos: { image_attachment: :blob })

    render inertia: "Products/Index", props: {
      products: products.map { |product| list_props(product) },
      filters: { q: params[:q].to_s, status: status, category: params[:category].to_s },
      counts: { active: Product.active.count, archived: Product.archived.count },
      categories: category_filters(status)
    }
  end

  # GET /products/:id
  def show
    render inertia: "Products/Show", props: { product: detail_props(@product) }
  end

  # GET /products/new
  def new
    render inertia: "Products/Form", props: { product: nil, presets: preset_props, categories: category_options }
  end

  # POST /products
  def create
    product = Product.new(product_params)

    if product.save_with_options(option_params)
      redirect_to product_path(product), notice: "Added #{product.name} with #{variant_count(product)}. Now add its photos."
    else
      redirect_to new_product_path, inertia: { errors: product.errors }
    end
  end

  # GET /products/:id/edit
  def edit
    render inertia: "Products/Form", props: {
      product: form_props(@product), presets: preset_props, categories: category_options(@product.category)
    }
  end

  # PATCH /products/:id
  def update
    @product.assign_attributes(product_params)

    if @product.save_with_options(option_params)
      redirect_to product_path(@product), notice: "Saved #{@product.name}."
    else
      redirect_to edit_product_path(@product), inertia: { errors: @product.errors }
    end
  end

  # PATCH /products/:id/listing   { listed: true | false }
  # The quick switch on the product's page: put it on the shop or take it off.
  def listing
    @product.update!(listed: ActiveModel::Type::Boolean.new.cast(params[:listed]) || false)
    redirect_to product_path(@product), notice: @product.listed? ? "#{@product.name} is now on the shop." : "#{@product.name} is off the shop."
  end

  # PATCH /products/:id/archive
  def archive
    @product.archived!
    redirect_to products_path, notice: "Archived #{@product.name}. Find it under Archived."
  end

  # PATCH /products/:id/restore
  def restore
    @product.active!
    redirect_to product_path(@product), notice: "#{@product.name} is active again."
  end

  private
    def set_product
      @product = Product.find(params.expect(:id))
    end

    def product_params
      params.expect(product: [ :name, :description, :price, :category_id, :low_stock_at, :listed ])
    end

    # Options arrive as a list of { name, values: [{ label, swatch }] }.
    # They are kept apart from product_params because they are not columns
    # on products; Product#save_with_options turns them into rows.
    def option_params
      params.fetch(:product, {}).permit(options: [ :name, { values: %i[ label swatch ] } ]).fetch(:options, [])
    end

    def variant_count(product)
      count = product.variants.size
      count == 1 ? "1 variant" : "#{count} variants"
    end

    # --- What each page receives. Money goes out as pesewas (integers);
    #     React formats it. Form fields get ready-to-edit strings. ---

    def list_props(product)
      prices = product.variants.map(&:selling_price_pesewas)

      {
        id: product.id,
        name: product.name,
        status: product.status,
        listed: product.listed,
        category: product.category&.name,
        cover_url: product.photos.first && photo_url(product.photos.first, :card),
        variants_count: product.variants.size,
        # nil when this person may not see stock; React then shows nothing.
        stock: can?("stock.view") ? product.variants.sum(&:stock_on_hand) : nil,
        price_from: prices.min || product.price_pesewas,
        price_to: prices.max || product.price_pesewas
      }
    end

    def detail_props(product)
      {
        id: product.id,
        name: product.name,
        description: product.description,
        status: product.status,
        listed: product.listed,
        shop_path: shop_product_path(product.shop_param),
        category: product.category&.name,
        price_pesewas: product.price_pesewas,
        options: product.options.map { |option| { name: option.name, values: option.values } },
        # Who she buys it from. nil (not sent) for people who can't see purchases.
        suppliers: can?("purchases.view") ? product.suppliers.ordered.map { |supplier|
          { id: supplier.id, name: supplier.name, phone: supplier.phone }
        } : nil,
        photos: product.photos.includes(image_attachment: :blob).map { |photo|
          { id: photo.id, thumb_url: photo_url(photo, :thumb), large_url: photo_url(photo, :large) }
        },
        max_photos: Product::MAX_PHOTOS,
        variants: product.variants.map { |variant|
          {
            id: variant.id,
            name: variant.name,
            sku: variant.sku,
            option_values: variant.option_values,
            price: variant.price, # "" when it follows the product price
            stock: can?("stock.view") ? variant.stock_on_hand : nil,
            level: can?("stock.view") ? variant.stock_level : nil,
            average_cost_pesewas: can?("costs.view") ? variant.average_cost_pesewas : nil,
            selling_price_pesewas: variant.selling_price_pesewas
          }
        }
      }
    end

    # The address of a resized copy of a photo. The copy is made the first
    # time someone asks for it, then reused.
    def photo_url(photo, size)
      rails_representation_path(photo.image.variant(size))
    end

    def form_props(product)
      {
        id: product.id,
        name: product.name,
        description: product.description.to_s,
        price: product.price,
        category_id: product.category_id,
        low_stock_at: product.low_stock_at,
        listed: product.listed,
        options: product.options.map { |option| { name: option.name, values: option.values } }
      }
    end

    # Categories to choose from on the form: the visible ones, plus the
    # product's current one even if it has since been hidden.
    def category_options(current = nil)
      (Category.active.ordered.to_a | [ current ].compact).map { |category| { id: category.id, name: category.name } }
    end

    # The filter chips above the product list, with a count on each.
    # Only categories that have products in this view are offered.
    def category_filters(status)
      counts = Product.where(status: status).group(:category_id).count
      filters = Category.ordered.filter_map { |category|
        { slug: category.slug, name: category.name, count: counts[category.id] } if counts[category.id]
      }
      filters << { slug: "none", name: "No category", count: counts[nil] } if counts[nil] && filters.any?
      filters
    end

    def preset_props
      OptionPreset.ordered.map { |preset|
        { id: preset.id, name: preset.name, option_name: preset.option_name, values: preset.values }
      }
    end
end
