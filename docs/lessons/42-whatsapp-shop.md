# 42. A shop on WhatsApp

## What a customer sees

> **Customer:** hi
> **Bot:** Hi Esi! Welcome to The Comfy Zone by Fazy 👗 [See what's in stock] [My order] [Talk to Fazy]
> **Customer:** palazzo orange
> **Bot:** *Luxe Drapped Palazzo* GH₵ 220, 8 left. Which size? (M, L, XL…)
> **Customer:** taps **M**, then **1**, then **Reserve now**
> **Bot:** ✅ Reserved! Order #243 … Pay within 10 minutes to MoMo 024 …, reference 243. [I've paid] [Cancel order]
> **Customer:** Sent. 5412398765
> **Bot:** 🙏 Thank you! Fazy will check the payment and confirm here shortly.

## The pieces

| File | Job |
|---|---|
| `controllers/webhooks/whatsapp_controller.rb` | Meta posts here. Checks the **signature**, files the message, answers at once. |
| `models/whatsapp/inbound.rb` | Reads Meta's JSON: messages, delivery ticks, and her own replies from the app (echoes). |
| `jobs/whatsapp_reply_job.rb` | Runs the bot for one message, with the chat **locked**. |
| `models/whatsapp/bot.rb` | The assistant: menu, browse, search, colour → size → how many, bag, reserve, pay, cancel, hand over. |
| `models/whatsapp/client.rb` | Sends through Meta, and logs everything. "Simulated" when not connected or in *Try it*. |
| `models/whatsapp/hold.rb` + two jobs | The clock: a reminder, then release. A sweep every minute is the safety net. |
| Inbox (`/admin/whatsapp`) and Settings → WhatsApp | Read and reply, take over or hand back. On/off, minutes, MoMo, and *Try it*. |

## Ideas worth knowing

**Webhooks: answer fast, work later.** Meta wants a quick `200 OK`, or it
retries. So the controller only saves the message and enqueues a job. The bot
replies from the job.

**Proving it's really Meta (HMAC).** Anyone could POST to a public URL. Meta signs
each request with a secret only Meta and our server know:
`sha256=HMAC(app_secret, body)`. We compute the same and compare with
`secure_compare`, which takes the same time either way, so it doesn't leak how
close a guess was.

**Idempotency.** Meta sometimes delivers a message twice. Every message has an id
(`wamid…`) with a unique index, so the second copy fails to save and is ignored.
The customer never gets two replies.

**One chat at a time (`with_lock`).** Two quick taps become two jobs. Locking the
chat's row makes the second wait for the first, so the bot's memory (`context`)
never gets mixed up.

**A state machine in a jsonb column.** `state` says where the bot is (menu,
choosing, quantity, bag, awaiting_payment). `context` remembers the details
(product, picks, bag, order). Every button carries an id ("pick:2", "qty:1",
"reserve") saying what it means, so a tap from an old message still makes sense.

**Reusing what exists.** Search is `VariantSearch` (the back office's "orange
3xl"). Reserving is `OrderTaker`, the same as a live claim. Prices follow the
bulk rule. Stock follows `Variant#available`, so pooled products work. The bot
adds no new rules about money or stock.

**Time limits that can't be lost.** Each reservation schedules two jobs
(reminder, expiry). If the server restarts at the wrong moment, the minute sweep
still releases anything overdue. `Hold.expire` re-checks inside a lock, so a
payment recorded at the same second wins.

**The 24-hour rule.** WhatsApp only lets a business write freely within 24 hours
of the customer's last message. The inbox shows when that window closes and
refuses free text after. Templates come in part 2.
