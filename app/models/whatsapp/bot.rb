# The WhatsApp shop assistant. One call per incoming message:
#
#   Whatsapp::Bot.new(chat).handle({ "text" => "orange 3xl" })
#   Whatsapp::Bot.new(chat).handle({ "id" => "product:12", "text" => "Palazzo" })
#
# A customer can:
#   - see what's in stock (a list), or just type what they want ("orange 3xl
#     palazzo", the same search as the back office)
#   - choose colour, then size (only what is in stock), then how many
#   - reserve: a real order (WhatsApp channel) that takes the stock and is
#     held for WhatsappSetting#hold_minutes; the bot sends the MoMo details
#   - say "I've paid" or send the MoMo transaction ID: the clock stops and
#     staff get a push to confirm the payment
#   - check their order, cancel it, or ask for Fazy (the bot then stays
#     quiet in that chat until she hands it back from the inbox)
#
# Every button and list row carries an id saying what it means:
#   menu  browse  browse:2  product:12  pick:0  qty:2  more  reserve
#   empty  paid  cancel_order  my_order  human
#
# In a "Try it" (sandbox) chat nothing real happens: no order, no stock.
module Whatsapp
  class Bot
    PAGE = 9 # list rows per page (WhatsApp allows 10; the 10th is "More")

    # Words people wrap around what they want; dropped before searching.
    FILLER = %w[ i want need do you have the a an in is are there please pls plz any some size colour color how much
                 price of for me get can could buy available still dey ooo o ok okay hello hi hey one ].freeze
    HELLO = %w[ hi hello hey menu start home morning afternoon evening good hii helo ].freeze

    def initialize(chat)
      @chat = chat
      @setting = WhatsappSetting.current
    end

    def handle(input)
      @input = input
      return if @chat.handed_off? # Fazy is replying herself
      return off_message unless @setting.enabled? || @chat.sandbox?

      id = input["id"].to_s
      return choose(id) if id.present?

      text = input["text"].to_s.squish
      words = text.downcase.scan(/[[:alnum:]]+/)

      if input["unsupported"]
        reply("I can only read text for now 🙂") && menu
      elsif awaiting_payment? && (paid_words?(words) || transaction_id(text))
        claim_payment(transaction_id(text))
      elsif quantity_step? && text.match?(/\A\d{1,3}\z/)
        add_to_bag(text.to_i)
      elsif words.empty? || (words - HELLO).empty? || words == %w[ menu ]
        menu
      elsif words.intersect?(%w[ human agent fazy person talk call ])
        hand_off
      elsif words.intersect?(%w[ order status ]) && words.size <= 3
        my_order
      else
        search(words)
      end
    end

    private
      attr_reader :chat, :setting

      # ---------- where to go next, from a button or list choice ----------

      def choose(id)
        case id
        when "menu" then menu
        when "browse" then browse(1)
        when /\Abrowse:(\d+)\z/ then browse(Regexp.last_match(1).to_i)
        when /\Aproduct:(\d+)\z/ then show_product(Regexp.last_match(1).to_i)
        when /\Apick:(\d+)\z/ then pick(Regexp.last_match(1).to_i)
        when /\Aqty:(\d+)\z/ then add_to_bag(Regexp.last_match(1).to_i)
        when "more" then browse(1)
        when "reserve" then reserve
        when "empty" then empty_bag
        when "paid" then claim_payment(nil)
        when "cancel_order" then cancel_order
        when "my_order" then my_order
        when "human" then hand_off
        else menu
        end
      end

      # ---------- the menu ----------

      def menu
        chat.update!(state: "menu")
        name = chat.profile_name.to_s.split.first
        bag = bag_count.positive? ? "\n\nYour bag has #{bag_count} #{bag_count == 1 ? 'item' : 'items'}." : ""
        buttons = [ [ "browse", "See what's in stock" ], [ "my_order", "My order" ], [ "human", "Talk to Fazy" ] ]
        buttons[1] = [ "reserve", "Reserve my bag" ] if bag_count.positive?
        Client.buttons(chat, "Hi#{name ? " #{name}" : ''}! #{setting.greeting} 👗\n\nTap below, or just type what you're looking for, " \
                             "like \"black dress XL\".#{bag}", buttons)
      end

      def off_message
        Client.text(chat, "Hi! Our WhatsApp shop isn't open right now. Fazy will reply to you here soon.")
      end

      # ---------- browsing ----------

      def in_stock_products
        Product.active.ordered.includes(:variants).select { |product| product.variants.any? { |variant| variant.available.positive? } }
      end

      def browse(page)
        products = in_stock_products
        return reply("Everything is sold out right now 😔 Ask Fazy what's coming next.") && hand_off_offer if products.empty?

        page = page.clamp(1, (products.size.to_f / PAGE).ceil)
        shown = products.slice((page - 1) * PAGE, PAGE)
        rows = shown.map { |product| { id: "product:#{product.id}", title: product.name, description: price_and_stock(product) } }
        rows << { id: "browse:#{page + 1}", title: "More…", description: "See more products" } if products.size > page * PAGE
        chat.update!(state: "browsing")
        Client.list(chat, page == 1 ? "Here's what's in stock. Tap to see one:" : "More of what's in stock:", "See products", rows)
      end

      def price_and_stock(product)
        prices = product.variants.select { |variant| variant.available.positive? }.map(&:selling_price_pesewas)
        price = prices.min == prices.max ? money(prices.min) : "from #{money(prices.min)}"
        left = product.stock_pooled? ? product.pooled_total : product.variants.sum { |variant| [ variant.available, 0 ].max }
        "#{price}, #{left} left"
      end

      # Typed: "orange 3xl", "do you have the palazzo in black?"
      def search(words)
        wanted = words - FILLER
        return menu if wanted.empty?

        variants = Product.active.includes(:variants).flat_map(&:variants).select { |variant| variant.available.positive? }
        found = VariantSearch.new(wanted.join(" ")).rank(variants)
        if found.empty?
          return Client.buttons(chat, "Sorry, I couldn't find \"#{wanted.join(' ')}\" in stock.",
                                [ [ "browse", "See what's in stock" ], [ "human", "Talk to Fazy" ] ])
        end

        products = found.map(&:product).uniq
        if products.size == 1
          # What they typed already answers some questions: "palazzo orange"
          # means colour = Orange, so only the size is asked.
          product = products.first
          hits = found.select { |variant| variant.product_id == product.id }
          known = option_order(product).filter_map { |name|
            labels = hits.map { |variant| label(variant, name) }.uniq
            [ name, labels.first ] if labels.size == 1 && labels.first
          }.to_h
          return start_product(product, hits.size == 1 && hits.first.option_values.any? ? hits.first : nil, picks: known)
        end

        rows = products.first(Client::MAX_ROWS).map { |product| { id: "product:#{product.id}", title: product.name, description: price_and_stock(product) } }
        chat.update!(state: "browsing")
        Client.list(chat, "Here's what I found:", "See them", rows)
      end

      # ---------- one product: colour, then size ----------

      def show_product(product_id)
        product = Product.active.includes(:variants, photos: { image_attachment: :blob }).find_by(id: product_id)
        return browse(1) unless product

        start_product(product, nil)
      end

      def start_product(product, exact, picks: {})
        photo = product.photos.first
        caption = "*#{product.name}*\n#{price_and_stock(product)}#{product.description.present? ? "\n\n#{product.description.truncate(300)}" : ''}"
        if photo && (url = photo_url(photo)) then Client.image(chat, url, caption) else reply(caption) end

        chat.remember(product_id: product.id, picks: picks, variant_id: nil)
        return ask_quantity(exact) if exact

        sellable = product.variants.select { |variant| variant.available.positive? }
        if sellable.size == 1 && sellable.first.option_values.empty?
          ask_quantity(sellable.first) # one item, nothing to choose
        else
          next_choice(product)
        end
      end

      # The options to ask, colour (the one with swatches) first, then the
      # product's own order. The same order as the back office.
      def option_order(product)
        names = product.variants.flat_map { |variant| variant.option_values.map { |value| value["name"] } }.uniq
        swatched = product.variants.flat_map(&:option_values).select { |value| value["swatch"].present? }.map { |value| value["name"] }.uniq
        swatched + (names - swatched)
      end

      # Ask the next option not yet chosen, offering only values in stock
      # given the earlier choices. An option with one value left is chosen
      # for them.
      def next_choice(product)
        picks = chat.context["picks"] || {}
        candidates = product.variants.select { |variant| variant.available.positive? && matches?(variant, picks) }
        return browse(1) if candidates.empty?

        name = option_order(product).find { |option| !picks.key?(option) }
        return ask_quantity(candidates.first) if name.nil?

        values = candidates.map { |variant| label(variant, name) }.uniq
        if values.size == 1
          chat.remember(picks: picks.merge(name => values.first))
          return next_choice(product)
        end

        chat.update!(state: "choosing")
        chat.remember(asking: name, values: values)
        rows = values.each_with_index.map do |value, index|
          left = product.stock_pooled? ? nil : candidates.select { |variant| label(variant, name) == value }.sum(&:available)
          { id: "pick:#{index}", title: value, description: left ? "#{left} left" : nil }
        end
        Client.list(chat, "Which #{name.downcase}?", "Choose #{name.downcase}", rows)
      end

      def pick(index)
        product = Product.active.includes(:variants).find_by(id: chat.context["product_id"])
        value = Array(chat.context["values"])[index]
        return browse(1) unless product && value

        chat.remember(picks: (chat.context["picks"] || {}).merge(chat.context["asking"] => value))
        next_choice(product)
      end

      def matches?(variant, picks)
        picks.all? { |name, value| label(variant, name) == value }
      end

      def label(variant, name)
        variant.option_values.find { |value| value["name"] == name }&.dig("label")
      end

      # ---------- how many, and the bag ----------

      def ask_quantity(variant)
        chat.update!(state: "quantity")
        chat.remember(variant_id: variant.id)
        left = variant.available - in_bag(variant)
        return reply("That one is all in your bag already.") && bag_summary if left <= 0

        choices = [ 1, 2, 3 ].select { |count| count <= left }.map { |count| [ "qty:#{count}", count.to_s ] }
        Client.buttons(chat, "#{variant.full_name}, #{money(variant.selling_price_pesewas)} each. How many?" \
                             "#{left > 3 ? " (Or type a number, up to #{left}.)" : ''}", choices)
      end

      def add_to_bag(count)
        variant = Variant.active.includes(:product).find_by(id: chat.context["variant_id"])
        return menu unless variant

        left = variant.available - in_bag(variant)
        return reply("Only #{[ left, 0 ].max} more of #{variant.full_name} left.") && ask_quantity(variant) if count < 1 || count > left

        bag = chat.bag.map(&:dup)
        line = bag.find { |entry| entry["variant_id"] == variant.id }
        line ? line["quantity"] += count : bag << { "variant_id" => variant.id, "quantity" => count }
        chat.remember(bag: bag, variant_id: nil, picks: {})
        bag_summary
      end

      def bag_summary
        lines = bag_lines
        return menu if lines.empty?

        chat.update!(state: "bag")
        total = lines.sum { |line| line[:total] }
        text = lines.map { |line| "#{line[:quantity]} × #{line[:variant].full_name} = #{money(line[:total])}" }.join("\n")
        Client.buttons(chat, "🛍️ *Your bag*\n#{text}\n\n*Total: #{money(total)}*", [
          [ "reserve", "Reserve now" ], [ "more", "Add more" ], [ "empty", "Empty my bag" ]
        ])
      end

      # The bag as variants and prices, bulk prices included (the order
      # itself works them out again when it is saved).
      def bag_lines
        variants = Variant.active.includes(:product).where(id: chat.bag.map { |entry| entry["variant_id"] }).index_by(&:id)
        pieces = Hash.new(0)
        chat.bag.each { |entry| (variant = variants[entry["variant_id"]]) && pieces[variant.product_id] += entry["quantity"] }
        chat.bag.filter_map do |entry|
          variant = variants[entry["variant_id"]]
          next unless variant

          bulk = BulkPricing.applies?(variant.product, pieces: pieces[variant.product_id], bulk_buyer: chat.customer&.bulk_buyer?)
          price = BulkPricing.unit_price(variant, bulk: bulk)
          { variant: variant, quantity: entry["quantity"], total: price * entry["quantity"] }
        end
      end

      def empty_bag
        chat.forget(:bag)
        reply("Your bag is empty.") && menu
      end

      def in_bag(variant)
        chat.bag.select { |entry| entry["variant_id"] == variant.id }.sum { |entry| entry["quantity"] }
      end

      def bag_count = chat.bag.sum { |entry| entry["quantity"].to_i }

      # ---------- reserving and paying ----------

      def reserve
        return menu if chat.bag.empty?
        return test_reserve if chat.sandbox?

        taker = OrderTaker.new(customer: chat.customer!, user: nil, sales_channel: SalesChannel.whatsapp, via: "WhatsApp",
                               note: "Reserved on WhatsApp", lines: chat.bag.map { |entry| { variant_id: entry["variant_id"], quantity: entry["quantity"] } })
        unless taker.save
          return reply("Sorry: #{taker.errors.full_messages.to_sentence}.") && bag_summary
        end

        order = taker.order
        held = setting.hold_minutes.minutes.from_now
        order.update!(whatsapp_conversation: chat, hold_until: held)
        WhatsappHoldJob.set(wait_until: held - 3.minutes).perform_later(order.id, "remind") if setting.hold_minutes > 4
        WhatsappHoldJob.set(wait_until: held).perform_later(order.id, "expire")
        chat.update!(state: "awaiting_payment")
        chat.remember(order_id: order.id, bag: [])
        pay_message(order)
      end

      def pay_message(order)
        Client.buttons(chat, "✅ *Reserved! Order ##{order.id}*\n#{order_lines(order)}\n\n*Total: #{money(order.due_pesewas)}*\n\n" \
                             "Please pay within *#{setting.hold_minutes} minutes* to:\n#{setting.momo_line}\n" \
                             "Reference: *#{order.id}*\n\nThen tap *I've paid*, or send the transaction ID.",
                       [ [ "paid", "I've paid" ], [ "cancel_order", "Cancel order" ] ])
      end

      def test_reserve
        lines = bag_lines
        chat.update!(state: "menu")
        chat.forget(:bag)
        Client.text(chat, "✅ *This is a test: nothing was saved and no stock was taken.*\n\n" \
                          "A customer would now see their order number, the total (#{money(lines.sum { |line| line[:total] })}), " \
                          "and how to pay:\n#{setting.momo_line}\nwith #{setting.hold_minutes} minutes to pay.")
      end

      def awaiting_payment? = chat.state == "awaiting_payment" && current_order&.claimed?
      def quantity_step? = chat.state == "quantity"

      def current_order
        @current_order ||= chat.context["order_id"] && Order.find_by(id: chat.context["order_id"])
      end

      def paid_words?(words) = words.intersect?(%w[ paid sent done transferred ])

      # A MoMo transaction ID: a run of 8 or more digits (possibly with letters).
      def transaction_id(text)
        text[/\b(?=[A-Za-z0-9.]*\d{6})[A-Za-z0-9.]{8,30}\b/]
      end

      def claim_payment(reference)
        order = current_order
        return my_order unless order&.claimed? && order.paid_pesewas.zero?

        order.update!(payment_claimed_at: Time.current, payment_claim: reference.presence || order.payment_claim)
        chat.update!(state: "menu")
        Push.notify("orders", title: "WhatsApp payment to confirm",
          body: "##{order.id}, #{chat.display_name}: #{money(order.due_pesewas)}#{reference ? " (ref #{reference})" : ''}.",
          path: "/admin/orders/#{order.id}")
        reply("🙏 Thank you! Fazy will check the payment and confirm here shortly.#{reference ? '' : ' If you have the transaction ID, send it too.'}")
      end

      def cancel_order
        order = current_order
        if order&.claimed? && order.paid_pesewas.zero?
          order.cancel!(by: nil)
          chat.update!(state: "menu")
          reply("Order ##{order.id} is cancelled. Nothing more to pay.") && menu
        else
          my_order
        end
      end

      def my_order
        order = chat.customer && chat.customer.orders.where.not(status: "cancelled").order(created_at: :desc).first
        return Client.buttons(chat, "You don't have an order with us yet.", [ [ "browse", "See what's in stock" ] ]) unless order

        status = { "claimed" => order.payment_claimed_at ? "waiting for Fazy to confirm your payment" : "waiting for payment",
                   "paid" => "paid, being packed", "packed" => "packed, on its way soon", "delivered" => "delivered",
                   "returned" => "returned" }[order.status] || order.status
        owing = order.balance_pesewas.positive? && order.status != "claimed" ? "\nStill to pay: #{money(order.balance_pesewas)}" : ""
        reply("*Order ##{order.id}*: #{status}.\n#{order_lines(order)}\nTotal: #{money(order.due_pesewas)}#{owing}")
      end

      # ---------- Fazy takes over ----------

      def hand_off
        chat.update!(handed_off_at: Time.current, state: "menu")
        Push.notify("orders", title: "WhatsApp: #{chat.display_name} wants to talk", body: @input["text"].to_s.truncate(100).presence || "Asked for you.",
                    path: "/admin/whatsapp/#{chat.id}")
        reply("Sure! Fazy will reply to you here shortly. 🙂")
      end

      def hand_off_offer
        Client.buttons(chat, "Want to talk to Fazy?", [ [ "human", "Talk to Fazy" ] ])
      end

      # ---------- small helpers ----------

      def reply(text)
        Client.text(chat, text)
      end

      def order_lines(order)
        order.items.includes(variant: :product).map { |item| "#{item.quantity} × #{item.variant.full_name}" }.join("\n")
      end

      def money(pesewas) = "GH₵ #{Pesewas.to_input(pesewas)}"

      def photo_url(photo)
        host = ENV["APP_HOST"].presence || "comfyzone.shop"
        Rails.application.routes.url_helpers.rails_representation_url(photo.image.variant(:large), host: host, protocol: "https")
      rescue StandardError
        nil
      end
  end
end
