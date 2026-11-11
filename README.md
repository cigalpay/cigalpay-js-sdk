# CigalPay JavaScript SDK

Official Node.js library for [CigalPay](https://cigalpay.com): accept crypto payments (BTC, ETH, USDT, SOL, LTC, DOGE and more) in your app, SaaS or website. Payments are priced in USD or EUR, and the customer picks the coin on the CigalPay checkout page.

- Node.js 18+ (also Bun and Deno). No dependencies.
- ESM, with TypeScript types included.
- **Server-side only**: it uses your credentials.

## Install

```bash
npm install cigalpay-js-sdk
```

## Credentials

Get these from your dashboard under **Settings → API credentials**:

| Value | Used for |
| --- | --- |
| Account ID | `createCheckout()` |
| API key | the payment API (`createPayment()`, `getPayment()`…) |
| Notification signing secret | `verifyWebhook()` |

## 1. Create a checkout

```js
import CigalPay from 'cigalpay-js-sdk';

const cigalpay = new CigalPay({
  accountId: process.env.CIGALPAY_ACCOUNT_ID,
  apiKey: process.env.CIGALPAY_API_KEY,
});

const { id, chargeLink } = await cigalpay.createCheckout({
  amount: 49.9,
  currency: 'USD',            // or 'EUR'
  orderId: 'order-1042',      // your reference, sent back as extraId
  description: 'Pro plan - 1 month',
  returnUrl: 'https://example.com/thanks',
  notifyUrl: 'https://example.com/cigalpay/webhook',
  lang: 'en',                 // en, fr, es, de
  feePaidBy: 'customer',      // optional: 'customer' adds the processing fee to the price; omit to use your dashboard setting
});

// save id with the order, then redirect the customer to chargeLink
```

## 2. Receive the payment notification

CigalPay POSTs the payment to `notifyUrl` each time its status changes. The `x-cigalpay-sig` header signs the body.

```js
import express from 'express';
import { CigalPay, isPaid } from 'cigalpay-js-sdk';

const app = express();

app.post('/cigalpay/webhook', express.json(), (req, res) => {
  if (!CigalPay.verifyWebhook(req.body, req.get('x-cigalpay-sig'), process.env.CIGALPAY_IPN_SECRET)) {
    return res.sendStatus(401);
  }
  const payment = req.body;
  const order = findOrder(payment.extraId);
  if (isPaid(payment.status) && order && payment.checkoutId === order.cigalpayCheckoutId) {
    // CONFIRMED or FINISHED, for the checkout you created: mark the order paid (only once)
  }
  res.sendStatus(200);
});
```

`verifyWebhook` accepts the parsed body, the raw string or a `Buffer`.

Statuses: `WAITING`, `CONFIRMING`, `CONFIRMED`, `SENDING`, `FINISHED`, `PARTIALLY_PAID`, `EXPIRED`, `FAILED` (exported as `PaymentStatus`). Ship only on `CONFIRMED` or `FINISHED`.

The same payment can be notified more than once, so make your handler idempotent.

Always compare `checkoutId` with the `id` that `createCheckout` returned for that order. Anyone can create a checkout with your account ID and one of your order references, so `extraId` alone doesn't prove the order was paid in full. `checkoutAmount` and `checkoutCurrency` give the checkout's price. When the customer paid the processing fee, `checkoutFee` and `checkoutTotal` (price + fee) are added; `checkoutAmount` stays your price.

**Test without paying:** in the dashboard, Settings → API → Test notification sends a signed sample to your URL. It carries `test: true` and the order reference `cigalpay-test`, so your server can ignore it.

## Payment API

Use the payment API if you build your own payment page. It needs `apiKey`.

```js
const payment = await cigalpay.createPayment({
  amount: 0.0015,
  currency: 'BTC',
  orderId: 'order-1042',
  notifyUrl: 'https://example.com/cigalpay/webhook',
  returnUrl: 'https://example.com/thanks',
});

await cigalpay.getPayment(payment.id);
await cigalpay.getPaymentsByOrder('order-1042');
await cigalpay.getActivePayments();
await cigalpay.getSupportedCoins();
```

## Your own payment page (white label)

Turn on **White label** in your dashboard (Settings → White label). Your server creates the checkout, then asks for the address to show on your page. The customer never sees a CigalPay payment page.

```js
const cigalpay = new CigalPay({ accountId: '...', apiKey: '...' });

const { id } = await cigalpay.createCheckout({ amount: 49.9, currency: 'USD', orderId: '1042', description: 'Order #1042', returnUrl, notifyUrl });

// A coin accepted directly:
const payment = await cigalpay.payCheckout({ checkoutId: id, coin: 'BTC' });

// A coin converted at payment: pass the paying customer as your server sees them.
const swap = await cigalpay.payCheckout({ checkoutId: id, swapCoin: 'XRP', customer: { ip: req.ip, userAgent: req.get('user-agent') } });
```

Show the returned address and exact amount, and confirm the order from the signed notification, as with a hosted checkout. Use `getSwapCoins()` and `quoteCheckout()` to list converted coins and show what the customer would send. Keep your API key on your server.

To send a payment to a specific wallet, add labelled addresses in Settings → Forwarding, each confirmed by email and used after 24 hours, then pass `forwardLabel` to `payCheckout()`. Your API key can only pick among those addresses, never add one. List them with `getForwardingLabels()`. An unknown or inactive label is refused.

To add your customers' wallets from your server, ask support to approve your account, then create a forwarding key in Settings → White label, limited to your server's IPs. Verify each wallet with your customer, then call `addForwardingAddress({ currency, label, address })`. It's used after 24 hours. You get an email with a cancel link for each new wallet, and the number of new wallets a day is limited. You are responsible for checking these wallets with your customers. List them with `getForwardingAddresses()`.

With white label on, CigalPay sends your customer no refund emails. Collect their address on your side and call `refundToAddress()` with your forwarding key: there's no refund page, and it goes to review like every refund. Check progress with `getRefunds()`.

## Refunds

Refund a paid payment from your server. It needs `apiKey`.

```js
const { refund, link } = await cigalpay.createRefund({
  paymentId: payment.id,              // the `id` in the payment notification
  checkoutAmount: 20,                 // in the checkout's USD / EUR, or `amount` in the coin paid
  customerEmail: 'customer@example.com',
  reason: 'Returned item',
});
link;                                 // the customer enters their address here

await cigalpay.getRefunds(payment.id); // status: awaiting_address, pending_review, sent...
```

- The refund and its network fee come out of your CigalPay balance in the payment's coin. A payment forwarded to your own wallet can't be refunded this way: refund it from that wallet.
- `checkoutAmount` is converted at the payment's rate, so the customer gets back the same share of the coin they sent.
- CigalPay's fee on the payment is not refunded.

## Errors

API failures throw `CigalPayError`:
- `status` is the HTTP status (`0` = network error or timeout).
- `body` is the parsed reply.

```js
import { CigalPayError } from 'cigalpay-js-sdk';

try {
  await cigalpay.getActivePayments();
} catch (err) {
  if (err instanceof CigalPayError) console.error(err.status, err.message);
}
```

Options: `checkoutUrl`, `apiUrl` and `timeoutMs` (default 15000).

## Upgrading from 1.x

2.0 is a rewrite:
- ESM with a `CigalPay` class.
- The current API hosts.
- Hosted checkout and webhook verification added.

## License

MIT
