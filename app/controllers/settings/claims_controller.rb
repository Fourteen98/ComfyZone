# Settings > Unpaid claims: how long a claim keeps its items before it goes
# back on sale (ClaimSetting, ClaimHold). Empty = no deadline.
class Settings::ClaimsController < InertiaController
  require_permission "settings.manage"

  def show
    setting = ClaimSetting.current
    render inertia: "Settings/Claims", props: {
      setting: setting.slice(:live_pay_hours, :sale_pay_hours, :remind_hours).transform_values { |value| value.nil? ? "" : value.to_s },
      # How the rule is doing: on the clock now, released in the last 30 days.
      running: ClaimHold.running.where(whatsapp_conversation_id: nil).count,
      released: Order.where(cancel_reason: ClaimHold::REASON, cancelled_at: 30.days.ago..).count
    }
  end

  def update
    setting = ClaimSetting.current
    fields = params.expect(claims: %i[ live_pay_hours sale_pay_hours remind_hours ])
    # An empty box means "no deadline".
    fields = fields.to_h.transform_values(&:presence)

    if setting.update(fields)
      redirect_to settings_claims_path, notice: "Saved. New claims follow these rules; ones already made keep their deadline."
    else
      redirect_to settings_claims_path, inertia: { errors: setting.errors }
    end
  end
end
