# "Tell me when it's back" on a sold-out size in the shop.
#
# Puts the shopper on the same waiting list she keeps in the back office, so
# when it returns she sees them alongside the people who asked on a live.
class Shop::WaitingController < Shop::BaseController
  # Public and free to submit: keep a script from filling her list.
  rate_limit to: 10, within: 10.minutes,
    with: -> { redirect_back_or_to root_path, alert: "Too many requests from this connection. Please try again later." }

  # POST /notify   { variant_id:, name:, phone: }
  def create
    variant = Variant.active.joins(:product).merge(Product.on_shop).find_by(id: params[:variant_id])
    phone = PhoneNumber.normalize(params[:phone])
    return redirect_back_or_to root_path, alert: "Sorry, that item can't be found." unless variant
    unless phone && PhoneNumber.valid?(phone)
      return redirect_back_or_to root_path, alert: "Please give a phone number we can WhatsApp, like 024 123 4567."
    end

    # The same number is the same person (see Customer.for_sale): someone
    # who has bought before joins the list as themselves.
    customer = Customer.for_sale(name: params[:name].to_s.squish.first(60).presence, phone: phone)
    StockRequest.ask!(customer: customer, variant: variant, source: "shop")
    redirect_back_or_to root_path, notice: "Done. We'll WhatsApp you when it's back."
  rescue ActiveRecord::RecordInvalid
    redirect_back_or_to root_path, alert: "We couldn't save that. Please check your number."
  end
end
