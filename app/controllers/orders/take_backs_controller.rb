# An item comes back and they want their money, not a swap (what they
# wanted is sold out, or they changed their mind). See Order#take_back!.
class Orders::TakeBacksController < InertiaController
  require_permission "orders.refund"

  # POST /orders/:order_id/take_back
  #   { item_id:, quantity:, restock:, refund: true, amount:, via:, reference: }
  def create
    order = Order.find(params.expect(:order_id))
    item = order.items.find(params.expect(:item_id))
    restock = params.key?(:restock) ? ActiveModel::Type::Boolean.new.cast(params[:restock]) : true
    refund = if ActiveModel::Type::Boolean.new.cast(params[:refund])
      { amount: params[:amount], via: params[:via], note: [ "Took back #{item.variant.full_name}", params[:reference].presence ].compact.join(". ") }
    end

    order.take_back!(item: item, quantity: params[:quantity], by: Current.user, restock: restock, refund: refund)

    notice = "Took back #{item.variant.full_name}."
    notice += refund ? " Refund recorded." : (order.balance_pesewas.negative? ? " There is money to give back." : "")
    redirect_to order_path(order), notice: notice
  rescue Order::WrongStage => problem
    redirect_to order_path(order), alert: problem.message
  rescue ActiveRecord::RecordInvalid => problem
    # A refund that didn't add up (more than they paid, no method chosen).
    redirect_to order_path(order), alert: "Nothing was saved. Refund #{problem.record.errors.full_messages.to_sentence.downcase}."
  end
end
