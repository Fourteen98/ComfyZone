# The shop window: everything she has listed, and one product's page.
class Shop::ProductsController < Shop::BaseController
  # "Only 2 left" appears at or below this. Above it the shopper just sees
  # that it is available: her exact stock is her business.
  FEW = 3

  # GET /            ?category=dresses  &q=wrap
  def index
    products = Product.on_shop.includes(:category, :variants, photos: { image_attachment: :blob })
    products = products.search(params[:q]) if params[:q].present?
    category = Category.find_by(slug: params[:category]) if params[:category].present?
    products = products.where(category: category) if category

    # Newest first: what she added last is usually what she is showing off.
    products = products.order(created_at: :desc).to_a
    # Things you can actually buy come before things that have sold out.
    in_stock, sold_out = products.partition { |product| product.variants.any? { |variant| variant.stock_on_hand.positive? } }

    render inertia: "Shop/Home", props: {
      products: (in_stock + sold_out).map { |product| card_props(product) },
      categories: Category.where(id: Product.on_shop.select(:category_id)).ordered.map { |c| { slug: c.slug, name: c.name } },
      filters: { category: category&.slug.to_s, q: params[:q].to_s }
    }
  end

  # GET /shop/12-ankara-wrap-dress
  def show
    # find_by + on_shop: an unlisted or archived product is a plain 404,
    # the same answer as one that never existed.
    product = Product.on_shop.includes(:options, :variants, photos: { image_attachment: :blob }).find_by(id: params[:id].to_i)
    raise ActiveRecord::RecordNotFound unless product

    render inertia: "Shop/Product", props: {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category&.name,
        photos: product.photos.map { |photo|
          { id: photo.id, large_url: rails_representation_path(photo.image.variant(:large)),
            thumb_url: rails_representation_path(photo.image.variant(:thumb)) }
        },
        options: product.options.map { |option| { name: option.name, values: option.values } },
        # "Buy 6 or more: GH₵ 100 each". Only if she offers it on the website.
        bulk: product.bulk? && product.bulk_on_shop? ? { price_pesewas: product.bulk_price_pesewas, from: product.bulk_min_quantity } : nil,
        variants: product.variants.map { |variant|
          {
            id: variant.id,
            option_values: variant.option_values,
            price_pesewas: variant.selling_price_pesewas,
            availability: availability(variant),
            # How many the stepper lets them pick. Capped, so it doesn't
            # reveal the real count when there are plenty.
            max: variant.stock_on_hand.clamp(0, Cart::MAX_EACH),
            few_left: variant.stock_on_hand.between?(1, FEW) ? variant.stock_on_hand : nil
          }
        }
      },
      in_cart: session[:cart].to_h.slice(*product.variants.map { |v| v.id.to_s })
    }
  end

  private
    def card_props(product)
      low, high = product.price_range
      photo = product.photos.first

      {
        path: shop_product_path(product.shop_param),
        name: product.name,
        category: product.category&.name,
        cover_url: photo && rails_representation_path(photo.image.variant(:card)),
        price_from_pesewas: low,
        varies: low != high,
        sold_out: product.variants.none? { |variant| variant.stock_on_hand.positive? },
        # Colour swatches under the card, if the product has a colour option.
        swatches: product.variants.flat_map { |v| v.option_values.filter_map { |value| value["swatch"].presence } }.uniq.first(6)
      }
    end

    def availability(variant)
      variant.stock_on_hand.positive? ? "in_stock" : "sold_out"
    end
end
