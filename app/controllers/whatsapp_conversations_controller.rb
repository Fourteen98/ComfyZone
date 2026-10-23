# The WhatsApp inbox: every chat, newest first, and one chat at a time to
# read and reply. Fazy can take a chat over (the bot goes quiet) and hand
# it back.
class WhatsappConversationsController < InertiaController
  include WhatsappMessageProps
  require_permission "orders.view", only: %i[ index show ]
  require_permission "orders.create", only: %i[ reply take_over hand_back ]
  before_action :set_chat, only: %i[ show reply take_over hand_back ]

  # GET /whatsapp
  def index
    chats = WhatsappConversation.real.recent_first.includes(:customer).limit(100)
    last = WhatsappMessage.where(whatsapp_conversation_id: chats.map(&:id)).group(:whatsapp_conversation_id).maximum(:id)
    previews = WhatsappMessage.where(id: last.values).index_by(&:whatsapp_conversation_id)

    render inertia: "Whatsapp/Index", props: {
      chats: chats.map { |chat| chat_props(chat).merge(preview: previews[chat.id]&.body.to_s.lines.first.to_s.truncate(80)) },
      connected: WhatsappSetting.connected?,
      enabled: WhatsappSetting.current.enabled?
    }
  end

  # GET /whatsapp/:id  (opening it marks it read)
  def show
    @chat.update_columns(unread: 0) if @chat.unread.positive?
    render inertia: "Whatsapp/Show", props: {
      chat: chat_props(@chat).merge(window_open: @chat.window_open?,
        window_closes: @chat.last_inbound_at && (@chat.last_inbound_at + WhatsappConversation::WINDOW).strftime("%-d %b, %-l:%M %P")),
      messages: @chat.messages.includes(:user).last(200).map { |message| message_props(message) },
      orders: @chat.orders.order(created_at: :desc).limit(10).map { |order|
        { id: order.id, status: order.status, total_pesewas: order.due_pesewas.nonzero? || order.total_pesewas, at: order.created_at.strftime("%-d %b, %-l:%M %P"),
          hold_until: order.hold_until&.strftime("%-l:%M %P"), payment_claim: order.payment_claimed_at && (order.payment_claim || "said they paid") }
      },
      can_reply: can?("orders.create")
    }
  end

  # POST /whatsapp/:id/reply   { body: "..." }
  def reply
    body = params[:body].to_s.strip
    return redirect_to(whatsapp_conversation_path(@chat), alert: "Type a message first.") if body.empty?
    unless @chat.window_open?
      return redirect_to whatsapp_conversation_path(@chat),
        alert: "It's been more than 24 hours since they wrote. WhatsApp only allows approved template messages now (coming in part 2)."
    end

    sent = Whatsapp::Client.text(@chat, body.first(4000), user: Current.user)
    # Replying by hand means she is in charge of this chat for now.
    @chat.update!(handed_off_at: @chat.handed_off_at || Time.current)
    if sent.status == "failed"
      redirect_to whatsapp_conversation_path(@chat), alert: "WhatsApp didn't take it: #{sent.error}"
    else
      redirect_to whatsapp_conversation_path(@chat)
    end
  end

  def take_over
    @chat.update!(handed_off_at: Time.current)
    redirect_to whatsapp_conversation_path(@chat), notice: "The bot is quiet in this chat. You reply."
  end

  def hand_back
    @chat.update!(handed_off_at: nil, state: "menu")
    redirect_to whatsapp_conversation_path(@chat), notice: "The bot answers this chat again."
  end

  private
    def set_chat
      @chat = WhatsappConversation.real.find(params.expect(:id))
    end

    def chat_props(chat)
      { id: chat.id, name: chat.display_name, phone: chat.phone, customer_id: chat.customer_id, unread: chat.unread,
        with_fazy: chat.handed_off?, at: chat.last_message_at&.strftime("%-d %b, %-l:%M %P") }
    end
end
