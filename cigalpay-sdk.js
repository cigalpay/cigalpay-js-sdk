// CigalPay JavaScript SDK - accept crypto payments in your app, SaaS or website.
// Server-side only (Node.js 18+, Bun, Deno): it uses your account
// credentials, which must never reach a browser.
//
// Docs: https://cigalpay.com/developers

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULTS = {
    checkoutUrl: 'https://coins-api.cigalpay.com',
    apiUrl: 'https://core-api.cigalpay.com',
    merchantApiUrl: 'https://merchant-api.cigalpay.com',
    timeoutMs: 15000,
};

/** Error from the CigalPay API: `status` is the HTTP status (0 = network), `body` the parsed reply. */
export class CigalPayError extends Error {
    constructor(message, status = 0, body = undefined) {
        super(message);
        this.name = 'CigalPayError';
        this.status = status;
        this.body = body;
    }
}

export class CigalPay {
    /**
     * @param {object} options
     * @param {string} [options.accountId]   Your account ID (dashboard > Settings) - for hosted checkouts.
     * @param {string} [options.apiKey]      Your API key (dashboard > Settings) - for the payment API.
     * @param {string} [options.checkoutUrl] Override the checkout API base URL.
     * @param {string} [options.apiUrl]      Override the payment API base URL.
     * @param {string} [options.merchantApiUrl] Override the refunds API base URL.
     * @param {number} [options.timeoutMs]   Request timeout (default 15 s).
     */
    constructor(options = {}) {
        if (typeof options !== 'object' || options === null) throw new TypeError('CigalPay: options must be an object');
        this.accountId = options.accountId;
        this.apiKey = options.apiKey;
        this.checkoutUrl = (options.checkoutUrl || DEFAULTS.checkoutUrl).replace(/\/+$/, '');
        this.apiUrl = (options.apiUrl || DEFAULTS.apiUrl).replace(/\/+$/, '');
        this.merchantApiUrl = (options.merchantApiUrl || DEFAULTS.merchantApiUrl).replace(/\/+$/, '');
        this.timeoutMs = options.timeoutMs || DEFAULTS.timeoutMs;
    }

    async #request(method, url, { body, headers = {} } = {}) {
        let res;
        try {
            res = await fetch(url, {
                method,
                headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        } catch (err) {
            throw new CigalPayError(`CigalPay unreachable: ${err?.message ?? err}`, 0);
        }
        const text = await res.text();
        let data;
        try {
            data = text ? JSON.parse(text) : undefined;
        } catch {
            data = text;
        }
        if (!res.ok) {
            const message = (data && (data.error || data.message)) || `HTTP ${res.status}`;
            throw new CigalPayError(`CigalPay: ${message}`, res.status, data);
        }
        return data;
    }

    #needs(field) {
        if (!this[field]) throw new CigalPayError(`CigalPay: pass \`${field}\` to the constructor to use this method`);
        return this[field];
    }

    #apiHeaders() {
        return { 'cigalpay-api-key': this.#needs('apiKey') };
    }

    // ── Hosted checkout (recommended) ─────────────────────────────────────

    /**
     * Create a payment priced in USD or EUR and get the checkout link to send
     * your customer to. They pick the coin on CigalPay's page; you get a signed
     * notification at `notifyUrl` when it's paid.
     *
     * @param {object} p
     * @param {number} p.amount         Price, e.g. 49.9
     * @param {'USD'|'EUR'} p.currency
     * @param {string} p.orderId        Your reference - sent back as `extraId` in notifications
     * @param {string} p.description    Shown to the customer
     * @param {string} p.returnUrl      Where the customer goes after paying
     * @param {string} p.notifyUrl      Your webhook URL (signed notifications)
     * @param {'en'|'fr'|'es'|'de'} [p.lang='en'] Checkout language
     * @returns {Promise<{ id: string, chargeLink: string, amount?: number, currency?: string }>}
     */
    createCheckout(p) {
        for (const k of ['amount', 'currency', 'orderId', 'description', 'returnUrl', 'notifyUrl']) {
            if (p?.[k] === undefined || p[k] === '') throw new CigalPayError(`CigalPay: createCheckout needs \`${k}\``);
        }
        return this.#request('POST', `${this.checkoutUrl}/api/pre-invoice`, {
            body: {
                accountId: this.#needs('accountId'),
                amount: p.amount,
                currency: p.currency,
                description: p.description,
                extraId: String(p.orderId),
                lang: p.lang || 'en',
                callback: p.returnUrl,
                ipn: p.notifyUrl,
            },
        });
    }

    // ── Payment API (you show the address yourself) ───────────────────────

    /**
     * Create a payment in a given coin (e.g. 'BTC', 'USDT_TRX') for an amount
     * in that coin. Prefer createCheckout() unless you build your own payment page.
     */
    createPayment({ amount, currency, orderId, notifyUrl, returnUrl }) {
        return this.#request('POST', `${this.apiUrl}/createPayment`, {
            headers: this.#apiHeaders(),
            body: {
                amount,
                currency,
                extraId: orderId === undefined ? undefined : String(orderId),
                ipnCallbackUrl: notifyUrl,
                invoiceCallbackUrl: returnUrl,
            },
        });
    }

    /** A payment by its id. */
    getPayment(id) {
        return this.#request('GET', `${this.apiUrl}/getPaymentStatus?id=${encodeURIComponent(id)}`, { headers: this.#apiHeaders() });
    }

    /** Every payment created for one of your order references. */
    getPaymentsByOrder(orderId) {
        return this.#request('GET', `${this.apiUrl}/getPaymentsByExtraId?extraId=${encodeURIComponent(orderId)}`, { headers: this.#apiHeaders() });
    }

    /** Payments still waiting for funds. */
    getActivePayments() {
        return this.#request('GET', `${this.apiUrl}/activePayments`, { headers: this.#apiHeaders() });
    }

    /** Coins accepted directly. */
    getSupportedCoins() {
        return this.#request('GET', `${this.apiUrl}/supportedCoins`);
    }

    // ── Refunds ───────────────────────────────────────────────────────────

    /**
     * Refund a paid payment. The amount and its network fee come out of your
     * CigalPay balance in the payment's coin; the customer gets a link to enter
     * the address to refund (by email when you pass customerEmail), then
     * CigalPay sends it. Needs `apiKey`.
     *
     * @param {object} p
     * @param {string} p.paymentId          The payment id (the `id` in its notifications)
     * @param {number} [p.amount]           In the coin paid...
     * @param {number} [p.checkoutAmount]   ...or in the checkout's USD / EUR, converted at the payment's rate
     * @param {string} [p.customerEmail]    Gets the link to enter their address
     * @param {string} [p.reason]
     * @returns {Promise<{ refund: object, link: string }>}
     */
    createRefund(p) {
        if (!p?.paymentId) throw new CigalPayError('CigalPay: createRefund needs `paymentId`');
        if ((p.amount === undefined) === (p.checkoutAmount === undefined)) {
            throw new CigalPayError('CigalPay: createRefund needs either `amount` or `checkoutAmount`');
        }
        return this.#request('POST', `${this.merchantApiUrl}/api/refunds`, {
            headers: this.#apiHeaders(),
            body: {
                paymentId: String(p.paymentId),
                amount: p.amount,
                checkoutAmount: p.checkoutAmount,
                customerEmail: p.customerEmail || undefined,
                reason: p.reason || undefined,
            },
        });
    }

    /** The refunds of a payment, newest first, with their status. */
    getRefunds(paymentId) {
        return this.#request('GET', `${this.merchantApiUrl}/api/refunds?paymentId=${encodeURIComponent(paymentId)}`, { headers: this.#apiHeaders() });
    }

    // ── Webhooks ──────────────────────────────────────────────────────────

    /**
     * Check a payment notification's `x-cigalpay-sig` header. Pass the parsed
     * JSON body (or the raw string), the header, and your notification signing
     * secret (dashboard > Settings). Only trust a notification when this
     * returns true - and only ship on status CONFIRMED or FINISHED.
     */
    static verifyWebhook(body, signature, secret) {
        if (!signature || !secret) return false;
        let payload = body;
        if (typeof body === 'string' || body instanceof Uint8Array) {
            try {
                payload = JSON.parse(typeof body === 'string' ? body : new TextDecoder().decode(body));
            } catch {
                return false;
            }
        }
        if (!payload || typeof payload !== 'object') return false;
        // Same serialisation CigalPay signs: JSON with the top-level keys sorted.
        const expected = createHmac('sha512', secret).update(JSON.stringify(payload, Object.keys(payload).sort())).digest('hex');
        const given = String(signature);
        return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    }
}

/** Payment statuses sent in notifications. CONFIRMED and FINISHED mean paid. */
export const PaymentStatus = Object.freeze({
    WAITING: 'WAITING',
    CONFIRMING: 'CONFIRMING',
    CONFIRMED: 'CONFIRMED',
    SENDING: 'SENDING',
    FINISHED: 'FINISHED',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    EXPIRED: 'EXPIRED',
    FAILED: 'FAILED',
});

/** True when a notification's status means the order is paid. */
export const isPaid = (status) => status === 'CONFIRMED' || status === 'FINISHED';

export default CigalPay;
