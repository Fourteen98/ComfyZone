# A size didn't fit: some of one line comes back and something else goes
# out instead. See Order#swap!.
class Orders::SwapsController < InertiaController
  # The same permission as returns: stock and money both move.
  require_permission "orders.refund"

  # POST /orders/:order_id/swap
  #   { item_id:, variant_id:, quantity:, restock:, same_price:, send_again: }
  def create
    order = Order.find(params.expect(:order_id))
    item = order.items.find(params.expect(:item_id))
    to = Variant.active.find(params.expect(:variant_id))
    flag = ->(name, default) { params.key?(name) ? ActiveModel::Type::Boolean.new.cast(params[name]) : default }

    order.swap!(item: item, to: to, quantity: params[:quantity], by: Current.user,
      restock: flag.(:restock, true), same_price: flag.(:same_price, true), send_again: flag.(:send_again, true))

    notice = "Swapped for #{to.full_name}."
    notice += " They owe #{helpers.number_to_currency(order.balance_pesewas / 100.0, unit: 'GH₵ ')}." if order.balance_pesewas.positive?
    notice += " There is #{helpers.number_to_currency(-order.balance_pesewas / 100.0, unit: 'GH₵ ')} to give back." if order.balance_pesewas.negative?
    redirect_to order_path(order), notice: notice
  rescue Order::WrongStage, StockLedger::NotEnough => problem
    redirect_to order_path(order), alert: problem.message
  end
end
