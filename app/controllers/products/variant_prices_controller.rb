# Saves the price of every variant of one product in a single request.
#
# A blank price means "follow the product's price".
class Products::VariantPricesController < InertiaController
  require_permission "products.manage"

  # PATCH /products/:product_id/variant_prices
  def update
    product = Product.find(params.expect(:product_id))
    errors = {}

    # One transaction: either every price saves, or none do.
    Variant.transaction do
      price_params.each do |row|
        # Through product.variants, so an id from another product is a 404.
        variant = product.variants.find(row[:id])
        variant.price = row[:price]
        errors["price_#{variant.id}"] = variant.errors[:price] unless variant.save
      end

      raise ActiveRecord::Rollback if errors.any?
    end

    if errors.any?
      redirect_to product_path(product), inertia: { errors: errors }
    else
      redirect_to product_path(product), notice: "Saved prices for #{product.name}."
    end
  end

  private
    def price_params
      params.expect(variants: [ [ :id, :price ] ])
    end
end
