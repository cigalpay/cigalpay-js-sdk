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

const { chargeLink } = await cigalpay.createCheckout({
  amount: 49.9,
  currency: 'USD',            // or 'EUR'
  orderId: 'order-1042',      // your reference, sent back as extraId
  description: 'Pro plan - 1 month',
  returnUrl: 'https://example.com/thanks',
  notifyUrl: 'https://example.com/cigalpay/webhook',
  lang: 'en',                 // en, fr, es, de
});

// redirect the customer to chargeLink
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
  if (isPaid(payment.status)) {
    // CONFIRMED or FINISHED: mark payment.extraId as paid (only once)
  }
  res.sendStatus(200);
});
```

`verifyWebhook` accepts the parsed body, the raw string or a `Buffer`.

Statuses: `WAITING`, `CONFIRMING`, `CONFIRMED`, `SENDING`, `FINISHED`, `PARTIALLY_PAID`, `EXPIRED`, `FAILED` (exported as `PaymentStatus`). Ship only on `CONFIRMED` or `FINISHED`.

The same payment can be notified more than once, so make your handler idempotent.

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
