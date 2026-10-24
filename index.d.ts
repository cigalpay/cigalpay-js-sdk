export interface CigalPayOptions {
    /** Your account ID (dashboard > Settings) - for hosted checkouts. */
    accountId?: string;
    /** Your API key (dashboard > Settings) - for the payment API. */
    apiKey?: string;
    checkoutUrl?: string;
    apiUrl?: string;
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
    createPayment(params: { amount: number; currency: string; orderId?: string | number; notifyUrl?: string; returnUrl: string }): Promise<Payment>;
    getPayment(id: string): Promise<Payment>;
    getPaymentsByOrder(orderId: string | number): Promise<Payment[]>;
    getActivePayments(): Promise<Payment[]>;
    getSupportedCoins(): Promise<unknown>;
    /** Check the `x-cigalpay-sig` header of a notification. */
    static verifyWebhook(body: string | Uint8Array | object, signature: string | undefined | null, secret: string): boolean;
}

export declare const PaymentStatus: Readonly<Record<PaymentStatusValue, PaymentStatusValue>>;
export declare function isPaid(status: string): boolean;
export default CigalPay;
