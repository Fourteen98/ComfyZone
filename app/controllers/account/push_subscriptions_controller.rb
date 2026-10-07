# Notifications on this device: switching them on and off, choosing what to
# hear about, and sending a test.
#
# The browser does the subscribing (it has to ask permission and talk to
# the push service), then posts the result here as JSON. So like passkeys,
# create answers with JSON rather than rendering a page.
class Account::PushSubscriptionsController < ApplicationController
  rate_limit to: 30, within: 3.minutes

  # POST /account/push_subscriptions
  # { endpoint:, keys: { p256dh:, auth: }, device: "Android phone" }
  def create
    subscription = PushSubscription.register!(
      user: Current.user,
      endpoint: params.require(:endpoint),
      p256dh: params.require(:keys).require(:p256dh),
      auth: params.require(:keys).require(:auth),
      device: params[:device]
    )

    render json: { id: subscription.id }
  rescue ActiveRecord::RecordInvalid => problem
    render json: { error: problem.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # PATCH /account/push_subscriptions/:id   { topics: ["low_stock"] }
  def update
    allowed = Push.topics_for(Current.user).map(&:key)
    mine.find(params.expect(:id)).update!(topics: Array(params[:topics]).map(&:to_s) & allowed)

    redirect_to account_path, notice: "Saved."
  end

  # POST /account/push_subscriptions/:id/test
  def test
    subscription = mine.find(params.expect(:id))
    sent = Push.configured? && Push.deliver(subscription,
      "title" => "The Comfy Zone", "body" => "Notifications are working on this device.", "path" => "/admin/account", "tag" => "test")

    if sent
      redirect_to account_path, notice: "Sent. It should appear in a moment."
    else
      redirect_to account_path, alert: "That didn't go through. Turn notifications off and on again on that device."
    end
  end

  # DELETE /account/push_subscriptions/:id
  def destroy
    mine.find(params.expect(:id)).destroy
    redirect_to account_path, notice: "Notifications are off on that device.", status: :see_other
  end

  private
    # Only ever her own devices: an id from someone else's is a 404.
    def mine
      Current.user.push_subscriptions
    end
end
