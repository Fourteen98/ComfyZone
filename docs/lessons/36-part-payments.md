# 36. Part payments

## What already worked

An order keeps a list of **payments** (money in, and refunds as negative amounts).
Its **balance** is what is due minus what has been paid. So paying in parts was
already possible on the order page: record GH₵ 100 now and GH₵ 85 next week, and
the order stays "To be paid" until the balance reaches zero. Then it moves to
"Paid" by itself (`Order#settle`). Owing orders appear in the *Owing* tab, on the
*Money owed to you* dashboard tile, and as "Owes GH₵ …" on the customer's page.

## What's new

1. **"Did they pay?" on Record a sale.** Choose *Not yet*, *All of it* or *Part of
   it* (type the amount), then how they paid. A bulk buyer's deposit is saved with
   the sale in one go.
2. **Clearer labels.** Lists say "Part paid, GH₵ 85 left". The payment box on the
   order page reminds her that she can change the amount to what they gave.

## Ideas worth knowing

**"all" instead of a number.** With bulk prices (lesson 33) and delivery fees, the
real total is only certain once Rails has saved the order. So "All of it" sends the
word `all`, and the server turns it into the balance *after* saving. The screen
never has to guess.

**One payment rule, reused.** The deposit goes through the same
`Order#record_payment!` as the order page. It locks the order, refuses more than
is owed, and records who took it. The rule isn't duplicated anywhere.

**When half of it fails.** The sale is saved first, then the payment. If the
payment is refused (say, GH₵ 500 typed for a GH₵ 120 order), the sale is kept,
because the stock really did go. She lands on the order with "The sale is
recorded, but not the payment: … Record it below." Nothing is silently lost.

**Permissions.** Taking money needs `orders.fulfil`, as on the order page. Someone
who may only record sales doesn't see "Did they pay?", and the server ignores a
payment sent anyway.
