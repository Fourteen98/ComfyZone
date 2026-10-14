# Sales saved halfway (OrderDraft). Opening one goes to Record a sale with
# it filled in: GET /orders/new?draft=5.
class OrderDraftsController < InertiaController
  require_permission "orders.create"

  # POST /orders/drafts   { draft: { label:, payload: {...} } }
  def create
    draft = OrderDraft.new(draft_params.merge(user: Current.user))
    if draft.save
      redirect_to orders_path(status: nil), notice: "Saved as a draft. Find it under Record a sale."
    else
      redirect_to new_order_path, alert: "Couldn't save the draft: #{draft.errors.full_messages.to_sentence}."
    end
  end

  # PATCH /orders/drafts/:id   (saving a resumed draft again)
  def update
    draft = OrderDraft.find(params.expect(:id))
    if draft.update(draft_params)
      redirect_to orders_path, notice: "Draft saved."
    else
      redirect_to new_order_path(draft: draft.id), alert: "Couldn't save the draft: #{draft.errors.full_messages.to_sentence}."
    end
  end

  # DELETE /orders/drafts/:id
  def destroy
    OrderDraft.find(params.expect(:id)).destroy!
    redirect_back_or_to new_order_path, notice: "Draft deleted.", status: :see_other
  end

  private
    # Exactly what a draft may hold: the sale screen's state (DraftState in
    # SaleCapture.tsx). `basket: {}` and `agreed: {}` allow any keys (variant
    # ids) with plain values. It is size-checked by the model, never used to
    # build a query, and checked again by Rails when the sale is recorded.
    PAYLOAD = [
      :channelId,
      { choice: [ :label, { buyer: %i[ id name phone handle ] } ] },
      { delivery: %i[ delivery_method fee address ] },
      { where: %i[ country region place ] },
      { basket: {} },
      { agreed: {} },
      { pay: %i[ when amount via reference ] }
    ].freeze

    def draft_params
      given = params.expect(draft: [ :label ])
      payload = params.dig(:draft, :payload)
      given.merge(payload: payload.respond_to?(:permit) ? payload.permit(*PAYLOAD).to_h : {})
    end
end
