# Adds a colour or size a product was missing, without leaving the page she
# is on (the purchase form): the goods in her hands are green, and the
# product only had black and red.
#
#   POST /products/:product_id/option_values   { option: "Colour", label: "Green", swatch: "#2e7d32" }
#
# Goes back to the page it came from, which reloads the product list with
# the new variants ready to be counted.
class Products::OptionValuesController < InertiaController
  require_permission "products.manage"

  def create
    product = Product.find(params.expect(:product_id))
    added = product.add_option_value(params[:option], label: params[:label], swatch: params[:swatch])

    if added
      what = added.size == 1 ? "1 new item" : "#{added.size} new items"
      redirect_back_or_to product_path(product), notice: "#{product.name} now comes in #{params[:label].to_s.squish} (#{what})."
    else
      redirect_back_or_to product_path(product), inertia: { errors: { option_value: [ product.errors.full_messages.first ] } }
    end
  end
end
