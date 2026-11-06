export interface CigalPayOptions {
    /** Your account ID (dashboard > Settings) - for hosted checkouts. */
    accountId?: string;
    /** Your API key (dashboard > Settings) - for the payment API. */
    apiKey?: string;
    /** Your forwarding key, to add customers' wallets. */
    forwardingKey?: string;
    checkoutUrl?: string;
    apiUrl?: string;
    merchantApiUrl?: string;
    /** Request timeout in ms (default 15000). */
    timeoutMs?: number;
}

export interface CheckoutParams {
    amount: number;
    currency: 'USD' | 'EUR';
    /** Your reference, sent back as `extraId` in notifications. */
    orderId: string | number;
    /** Shown to the customer. */
    description: string;
    /** Where the customer goes after paying. */
    returnUrl: string;
    /** Your webhook URL for signed notifications. */
    notifyUrl: string;
    lang?: 'en' | 'fr' | 'es' | 'de';
}

export interface Checkout {
    id: string;
    /** Send your customer here. */
    chargeLink: string;
    amount?: number;
    currency?: string;
    [key: string]: unknown;
}

export type PaymentStatusValue = 'WAITING' | 'CONFIRMING' | 'CONFIRMED' | 'SENDING' | 'FINISHED' | 'PARTIALLY_PAID' | 'EXPIRED' | 'FAILED';

/** A payment as returned by the API and sent in notifications. */
export interface Payment {
    id: string;
    status: PaymentStatusValue;
    currency: string;
    amount: number;
    amountPaid: number;
    /** Your order reference. */
    extraId?: string;
    publicKey: string;
    /** Set when the customer paid in another coin, converted at checkout. */
    swapFromCurrency?: string;
    swapFromNetwork?: string;
    swapFromAmount?: string;
    /** Set when the payment comes from a hosted checkout: its id (as createCheckout returned it) and price. */
    checkoutId?: string;
    checkoutAmount?: string;
    checkoutCurrency?: 'USD' | 'EUR';
    [key: string]: unknown;
}

export interface RefundParams {
    /** The payment id (the `id` in its notifications). */
    paymentId: string;
    /** In the coin paid. Pass this or `checkoutAmount`. */
    amount?: number;
    /** In the checkout's USD / EUR, converted at the payment's rate. */
    checkoutAmount?: number;
    /** Gets the link to enter their refund address. */
    customerEmail?: string;
    reason?: string;
}

export type RefundStatus = 'awaiting_address' | 'pending_review' | 'sent' | 'rejected' | 'cancelled' | 'expired';

export interface Refund {
    id: string;
    paymentId: string;
    currency: string;
    amount: number;
    networkFee: number;
    reason: string | null;
    customerEmail: string | null;
    address: string | null;
    status: RefundStatus;
    txHash: string | null;
    expiresAt: string;
    createdAt: string;
    [key: string]: unknown;
}

export declare class CigalPayError extends Error {
    /** HTTP status, 0 for a network error. */
    status: number;
    body: unknown;
}

export declare class CigalPay {
    constructor(options?: CigalPayOptions);
    createCheckout(params: CheckoutParams): Promise<Checkout>;
    /** Needs white label turned on in your dashboard settings. Send `coin`, or `swapCoin` with `customer.ip`. */
    payCheckout(params: {
        checkoutId: string;
        coin?: string;
        swapCoin?: string;
        customer?: { ip: string; userAgent?: string; languages?: string };
        /** Which confirmed forwarding address gets this payment. */
        forwardLabel?: string;
    }): Promise<Record<string, unknown>>;
    /** Add a customer's wallet you have verified. Used after 24 hours. Needs the forwarding key. */
    addForwardingAddress(params: { currency: string; label: string; address: string }): Promise<{ id: string; currency: string; label: string; address: string; activatesAt: string }>;
    getForwardingAddresses(): Promise<{ wallets: { id: string; currency: string; label: string; address: string; status: string; createdAt: string }[] }>;
    /** Refund to your customer's address. Send `amount` or `checkoutAmount`. Needs the forwarding key. */
    refundToAddress(params: { paymentId: string; address: string; amount?: number; checkoutAmount?: number; reason?: string }): Promise<{ refund: Refund }>;
    removeForwardingLabel(id: string): Promise<{ removed: boolean }>;
    getForwardingLabels(): Promise<{ labels: { id: string; currency: string; label: string; address: string; activatesAt: string; active: boolean }[] }>;
    quoteCheckout(params: { checkoutId: string; swapCoin: string }): Promise<Record<string, unknown>>;
    getSwapCoins(): Promise<Record<string, unknown>>;
    createPayment(params: { amount: number; currency: string; orderId?: string | number; notifyUrl?: string; returnUrl: string }): Promise<Payment>;
    getPayment(id: string): Promise<Payment>;
    getPaymentsByOrder(orderId: string | number): Promise<Payment[]>;
    getActivePayments(): Promise<Payment[]>;
    getSupportedCoins(): Promise<unknown>;
    /** Refund a paid payment from your CigalPay balance. Needs `apiKey`. */
    createRefund(params: RefundParams): Promise<{ refund: Refund; link: string }>;
    getRefunds(paymentId: string): Promise<{ data: Refund[] }>;
    /** Check the `x-cigalpay-sig` header of a notification. */
    static verifyWebhook(body: string | Uint8Array | object, signature: string | undefined | null, secret: string): boolean;
}

export declare const PaymentStatus: Readonly<Record<PaymentStatusValue, PaymentStatusValue>>;
export declare function isPaid(status: string): boolean;
export default CigalPay;
