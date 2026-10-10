# The waiting list: who asked for what, and who to tell now it's back.
#
#   GET    /admin/waiting                  the list
#   POST   /admin/waiting                  put someone on it
#   PATCH  /admin/waiting/:id/told         she has messaged them
#   DELETE /admin/waiting/:id              take them off (bought elsewhere, changed mind)
class WaitingListController < InertiaController
  require_permission "customers.view", only: :index
  require_permission "customers.manage", except: %i[ index create ]
  # Adding someone is also part of selling: whoever records sales may do it
  # (a helper on a live writes down "@ama wants the 3XL").
  before_action :may_add, only: :create

  def index
    back = StockRequest.back_in_stock.includes(:customer, variant: :product).order(:told_at, :created_at)
    waiting = StockRequest.still_waiting.includes(:customer, variant: :product).order(:created_at)

    render inertia: "Waiting/Index", props: {
      # One row per person: she messages each of them.
      back: back.map { |request| row_props(request) },
      # Grouped by item, most wanted first: this is demand.
      waiting: waiting.group_by(&:variant).map { |variant, requests|
        {
          variant_id: variant.id,
          product: variant.product.name,
          variant: variant.name,
          wanted: requests.sum(&:quantity),
          people: requests.map { |request| row_props(request) }
        }
      }.sort_by { |group| -group[:wanted] },
      can_manage: can?("customers.manage")
    }
  end

  # POST /admin/waiting
  #   { variant_id:, customer_id: } or { variant_id:, buyer: { name, phone, handle } }
  def create
    variant = Variant.find(params.expect(:variant_id))
    customer = find_customer

    if customer.nil?
      return redirect_back_or_to waiting_list_index_path, alert: "Say who is asking: pick a customer, or give a name, number or username."
    end

    request = StockRequest.ask!(customer: customer, variant: variant, user: Current.user,
      source: params[:source].presence_in(StockRequest::SOURCES) || "manual", quantity: params[:quantity] || 1, note: params[:note])
    redirect_back_or_to waiting_list_index_path, notice: "#{customer.display_name} is on the waiting list for #{variant.full_name}."
  rescue ActiveRecord::RecordInvalid => problem
    redirect_back_or_to waiting_list_index_path, alert: problem.record.errors.full_messages.to_sentence
  end

  # PATCH /admin/waiting/:id/told
  def told
    StockRequest.open.find(params.expect(:id)).told!
    redirect_back_or_to waiting_list_index_path
  end

  # DELETE /admin/waiting/:id
  def destroy
    request = StockRequest.open.find(params.expect(:id))
    request.close!
    redirect_back_or_to waiting_list_index_path, status: :see_other, notice: "#{request.customer.display_name} is off the list for #{request.variant.full_name}."
  end

  private
    def may_add
      return if can?("customers.manage") || can?("orders.create")

      redirect_to admin_root_path, alert: "You don't have access to that. Ask an Owner if you need it."
    end

    def find_customer
      if params[:customer_id].present?
        Customer.find_by(id: params[:customer_id])
      elsif params[:buyer].respond_to?(:permit)
        given = params[:buyer].permit(:name, :phone, :handle).to_h.symbolize_keys
        given.values.any?(&:present?) ? Customer.for_sale(**given) : nil
      end
    end

    def row_props(request)
      customer = request.customer
      {
        id: request.id,
        customer_id: customer.id,
        customer: customer.display_name,
        phone: customer.phone,
        product: request.variant.product.name,
        variant: request.variant.name,
        quantity: request.quantity,
        since: request.created_at.strftime("%-d %b"),
        source: request.source,
        told: request.told_at&.strftime("%-d %b"),
        message: request.message
      }
    end
end
