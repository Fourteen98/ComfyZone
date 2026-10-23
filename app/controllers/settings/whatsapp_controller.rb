# Settings > WhatsApp: switch the shop on, the hold time, the MoMo details,
# whether WhatsApp is connected, and "Try it": a pretend chat with the bot
# that never touches real orders or stock.
class Settings::WhatsappController < InertiaController
  include WhatsappMessageProps
  require_permission "settings.manage"

  TRY_PHONE = "+233000000000" # not a real number: the sandbox chat

  def show
    setting = WhatsappSetting.current
    render inertia: "Settings/Whatsapp", props: {
      setting: setting.slice(:enabled, :hold_minutes, :momo_number, :momo_name, :momo_network, :welcome).transform_values { |value| value.nil? ? "" : value },
      connection: {
        connected: WhatsappSetting.connected?,
        # Which keys the server has (never their values).
        keys: %w[ WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_APP_SECRET WHATSAPP_VERIFY_TOKEN ].to_h { |key| [ key, ENV[key].present? ] },
        webhook_url: "https://#{ENV['APP_HOST'].presence || request.host}/webhooks/whatsapp",
        last_inbound: WhatsappMessage.inbound.joins(:whatsapp_conversation).merge(WhatsappConversation.real).maximum(:created_at)&.strftime("%-d %b, %-l:%M %P")
      },
      trial: (chat = WhatsappConversation.find_by(phone: TRY_PHONE)) ? chat.messages.last(60).map { |message| message_props(message) } : []
    }
  end

  def update
    setting = WhatsappSetting.current
    if setting.update(params.expect(whatsapp: %i[ enabled hold_minutes momo_number momo_name momo_network welcome ]))
      redirect_to settings_whatsapp_path, notice: setting.enabled? ? "Saved. The WhatsApp shop is on." : "Saved. The WhatsApp shop is off."
    else
      redirect_to settings_whatsapp_path, inertia: { errors: setting.errors }
    end
  end

  # POST /settings/whatsapp/try   { text: "hi" } or { id: "browse", text: "See what's in stock" }
  # Answered at once (no job), so the reply is there when the page reloads.
  def try
    chat = WhatsappConversation.for(TRY_PHONE, name: Current.user.name.split.first, sandbox: true)
    said = { "id" => params[:id].presence, "text" => params[:text].to_s.first(500) }.compact
    chat.messages.create!(direction: "in", kind: said["id"] ? "choice" : "text", body: said["text"], payload: said, status: "received")
    chat.update!(last_inbound_at: Time.current, last_message_at: Time.current)
    chat.with_lock { Whatsapp::Bot.new(chat).handle(said) }
    redirect_to settings_whatsapp_path
  end

  # DELETE /settings/whatsapp/try   start the pretend chat again
  def reset_try
    WhatsappConversation.where(phone: TRY_PHONE).destroy_all
    redirect_to settings_whatsapp_path
  end
end
