# Connecting the WhatsApp shop

ComfyZone talks to WhatsApp through **Meta's WhatsApp Cloud API**. Until the four
keys below are on the server, the bot only runs as **Settings → WhatsApp → Try
it**, and nothing is sent to anyone.

## Before you start: which number?

| Option | What it means |
|---|---|
| **A new number** (simplest) | A SIM that has never been on WhatsApp, or one you remove from the app first. Customers message that number. Her current number stays in the WhatsApp Business app as it is. |
| **Her current number, keeping the app** ("coexistence") | She keeps using the WhatsApp Business app *and* the bot answers on the same number. Meta only allows this through its **Embedded Signup**, which needs a **Meta Tech Provider** or a **WhatsApp provider** (such as 360dialog). It's not available when connecting directly. |

What changes with coexistence (from Meta's documentation):
- Group chats aren't brought across.
- Existing broadcast lists become read-only.
- Disappearing and view-once messages are turned off in one-to-one chats.
- Linked devices are unlinked (WhatsApp for Windows isn't supported).
- The app must be version 2.24.17 or newer.
- The phone must be opened at least every ~14 days, or the number is disconnected.
- Messages she sends from the app stay free. ComfyZone receives a copy of each, so the bot steps back from that chat by itself.

## Steps (connecting directly, with a number for the bot)

1. **Meta Business account.** Go to business.facebook.com, create or open the
   business portfolio, and complete **business verification** (business
   documents).
2. **Meta app.** Go to developers.facebook.com → *My Apps* → *Create app* →
   type **Business**. Add the **WhatsApp** product.
3. **Phone number.** In *WhatsApp → API Setup*, add the bot's number and verify
   it by SMS or call. Note the **Phone number ID** (not the number itself).
4. **A permanent access token.** In Business settings → *System users*, add a
   system user (Admin) and assign it the app and the WhatsApp account. Then
   *Generate token* with the permissions `whatsapp_business_messaging` and
   `whatsapp_business_management`. Copy the token now: it's shown once.
5. **App secret.** App → *App settings → Basic* → **App secret** → *Show*.
6. **Verify token.** Make one up: any long random text. You'll type it in two
   places. One way to make one:
   `openssl rand -hex 24`
7. **Put the keys on the server** in `deploy/.env` (never in git):
   ```
   WHATSAPP_ACCESS_TOKEN=...      # step 4
   WHATSAPP_PHONE_NUMBER_ID=...   # step 3
   WHATSAPP_APP_SECRET=...        # step 5
   WHATSAPP_VERIFY_TOKEN=...      # step 6
   APP_HOST=comfyzone.shop
   ```
   Then restart: `docker compose up -d` (in `deploy/`).
8. **Webhook.** In the app → *WhatsApp → Configuration → Webhook*:
   - Callback URL: `https://comfyzone.shop/webhooks/whatsapp` (Settings →
     WhatsApp shows the exact address)
   - Verify token: the one from step 6 → *Verify and save*
   - Subscribe to the **messages** field. With coexistence, also subscribe to
     **smb_message_echoes**.
9. **Payment method.** In WhatsApp Manager, add a card. Since 1 October 2026,
   replies beyond the first 1,000 a month per number are paid, and messages you
   start are always paid.
10. **Switch it on.** In ComfyZone, go to Settings → WhatsApp. Fill in the MoMo
    number and name, set the minutes to pay (10), tick **Open**, and save. The
    page should now say **Connected**.
11. **Test with your own phone.** Message the number "hi", reserve something,
    tap *Cancel order*, and check that the order appears and cancels in Orders.

## How it works (short)

- Meta posts every message to `/webhooks/whatsapp`. ComfyZone checks Meta's
  signature (the app secret), saves the message, and answers from a background
  job.
- **Reserving** creates a real order (channel: WhatsApp) that takes the stock.
  It's held for the minutes set in Settings, with a reminder 3 minutes before,
  then cancelled with the stock put back. If the customer taps "I've paid" or
  sends a transaction ID, the clock stops, and staff get a push to check MoMo
  and record the payment. The customer is then thanked automatically.
- **"Talk to Fazy"**, or her replying from the inbox (or from the phone app with
  coexistence), quiets the bot in that chat until **Hand back to the bot**.
- **24-hour rule.** You can reply freely for 24 hours after the customer's last
  message. After that, only Meta-approved templates can be sent (part 2).

## Coming next (part 2)

- Messages ComfyZone starts, using approved templates: order confirmed, out for
  delivery, back in stock.
- Hubtel payment links, so paid orders mark themselves paid.
