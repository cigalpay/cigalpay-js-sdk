# cigalpay-Js-sdk

CigalPay-JS-SDK is a lightweight JavaScript library for seamless integration with the CigalPay cryptocurrency payment gateway. It offers methods for initiating payments, retrieving payment details, and checking transaction statuses, making it ideal for web-based crypto payment solutions.

## Features

- Accept multiple cryptocurrencies including BTC, ETH, LTC, DOGE, DASH, SOL, MATIC and BCH.
- Real-time payment tracking.
- Secure API with AES-256 encryption.
- Easy-to-use PHP SDK with Composer support.

## Installation

To install the CigalPay JS SDK using npm or via cdn:

### Usage via CDN

```js
<script src="https://cdn.jsdelivr.net/npm/cigalpay-sdk"></script>
```

```js
const sdk = new CigalpaySDK('https://api.cigalpay.icu', 'your-api-key');
```

```js
sdk.createPayment(0.03, 'LTC', 'order123', 'https://callback.url/ipn', 'https://callback.url/invoice').then(console.log);
```

### Usage via NPM

....

## Available Methods

- `createPayment(amount, currency, extraId, ipnCallbackUrl, invoiceCallbackUrl)`
- `getInvoiceStatus(invoiceId)`
- `getPaymentStatus(id)`
- `getPaymentsByExtraId(extraId)`
- `getActivePayments()`

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests for improvements.