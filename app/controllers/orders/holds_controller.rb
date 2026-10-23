# The pay-by deadline on an unpaid claim (ClaimHold).
#
#   PATCH  /orders/:order_id/hold   { hours: 24 }   more time: 24 hours from the
#                                                   later of now and the deadline
#   DELETE /orders/:order_id/hold                   no deadline: keep it until she decides
#
# Also starts a deadline on an unpaid order that has none.
class Orders::HoldsController < InertiaController
  require_permission "orders.create"
  before_action :set_order

  def update
    hours = params[:hours].to_i
    return redirect_back_or_to(order_path(@order), alert: "Give between 1 hour and 30 days.") unless hours.between?(1, 720)

    from = [ @order.hold_until, Time.current ].compact.max
    @order.update!(hold_until: from + hours.hours, hold_reminded_at: nil)
    redirect_back_or_to order_path(@order), notice: "#{@order.customer.display_name} has until #{deadline_words(@order.hold_until)} to pay."
  end

  def destroy
    @order.update!(hold_until: nil, hold_reminded_at: nil)
    redirect_back_or_to order_path(@order), notice: "No deadline: this order keeps its items until you decide."
  end

  private
    # Only an unpaid claim has a clock to change.
    def set_order
      @order = Order.find(params.expect(:order_id))
      return if @order.claimed? && @order.paid_pesewas.zero?

      redirect_back_or_to order_path(@order), alert: "Only an unpaid order has a deadline to pay."
    end

    def deadline_words(time)
      time.to_date == Date.current ? time.strftime("%-l:%M %P today") : time.strftime("%a %-d %b, %-l:%M %P")
    end
end
