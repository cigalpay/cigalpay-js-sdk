import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import CigalPay, { CigalPayError, isPaid } from '../cigalpay-sdk.js';

// Signed exactly as core-api does (GenericTransactionalWallet.updateStatus).
const sign = (details, secret) => createHmac('sha512', secret).update(JSON.stringify(details, Object.keys(details).sort())).digest('hex');
const payment = { status: 'CONFIRMED', id: 'b3f7688f-1529-48b1-bf4d-e7467e24de46', amount: 49, amountPaid: 49, currency: 'USDT_TRX', extraId: '1042', expiresAt: '2026-10-20T07:48:00.000Z', swapFromCurrency: 'BSC' };

test('verifyWebhook accepts a genuine notification (object, string and bytes)', () => {
    const sig = sign(payment, 's3cret');
    assert.equal(CigalPay.verifyWebhook(payment, sig, 's3cret'), true);
    assert.equal(CigalPay.verifyWebhook(JSON.stringify(payment), sig, 's3cret'), true);
    assert.equal(CigalPay.verifyWebhook(new TextEncoder().encode(JSON.stringify(payment)), sig, 's3cret'), true);
});

test('verifyWebhook rejects tampering, a wrong secret and missing input', () => {
    const sig = sign(payment, 's3cret');
    assert.equal(CigalPay.verifyWebhook({ ...payment, amountPaid: 4900 }, sig, 's3cret'), false);
    assert.equal(CigalPay.verifyWebhook(payment, sig, 'other'), false);
    assert.equal(CigalPay.verifyWebhook(payment, undefined, 's3cret'), false);
    assert.equal(CigalPay.verifyWebhook('not json', sig, 's3cret'), false);
});

test('isPaid', () => {
    assert.equal(isPaid('CONFIRMED'), true);
    assert.equal(isPaid('FINISHED'), true);
    assert.equal(isPaid('CONFIRMING'), false);
});

test('missing credentials and fields fail before any request', () => {
    const c = new CigalPay();
    assert.throws(() => c.createCheckout({ amount: 1, currency: 'USD', orderId: '1', description: 'x', returnUrl: 'https://a.b', notifyUrl: 'https://a.b' }), CigalPayError);
    assert.throws(() => new CigalPay({ accountId: 'x' }).createCheckout({ amount: 1 }), /needs `currency`/);
});

test('verifyWebhook handles nested objects and number formats like core-api', () => {
    const d = { b: 1, tiny: 1e-7, note: 'Café / "q"', a: { b: 2, z: 3, a: [1, { a: 1, q: 9 }] } };
    const sig = sign(d, 'k');
    assert.equal(CigalPay.verifyWebhook(JSON.stringify(d), sig, 'k'), true);
    assert.equal(CigalPay.verifyWebhook(JSON.parse(JSON.stringify(d)), sig, 'k'), true);
});
