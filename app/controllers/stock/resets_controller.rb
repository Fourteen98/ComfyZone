# Setting many counts at once, and undoing it (StockReset).
#
#   POST   /stock/reset          { variant_ids: [3, 4], to: "0" }        chosen items
#   POST   /stock/reset          { everything: true, confirm: "RESET" }  full reset
#   DELETE /stock/reset/:batch                                           undo a reset
class Stock::ResetsController < InertiaController
  require_permission "stock.adjust"

  def create
    reset = StockReset.new(user: Current.user, variant_ids: params[:variant_ids], to: params[:to],
      everything: params[:everything], confirm: params[:confirm])

    if !reset.save
      redirect_back_or_to stock_index_path, alert: reset.errors.full_messages.first
    elsif reset.changed.zero?
      redirect_back_or_to stock_index_path, notice: "Nothing changed: those counts were already #{params[:to].presence || 0}."
    else
      redirect_to stock_index_path, notice: reset.summary
    end
  end

  def destroy
    undone = StockReset.undo!(batch: params.expect(:batch), user: Current.user)
    redirect_to stock_index_path, notice: "Undone. #{undone == 1 ? '1 item is' : "#{undone} items are"} back to what they were (sales since are kept)."
  rescue ArgumentError => problem
    redirect_to stock_index_path, alert: problem.message
  end
end
