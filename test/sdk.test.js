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

test('createRefund and getRefunds call the refunds API with the API key', async () => {
    const { createServer } = await import('node:http');
    const seen = [];
    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            seen.push({ method: req.method, url: req.url, key: req.headers['cigalpay-api-key'], body: body ? JSON.parse(body) : undefined });
            if (req.method === 'POST' && seen.at(-1).body.checkoutAmount > 40) {
                res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'You can refund at most 35 USDT_TRX on this payment.' }));
                return;
            }
            res.writeHead(req.method === 'POST' ? 201 : 200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(req.method === 'POST' ? { refund: { id: 'r1', amount: 10 }, link: 'https://pay/refund/t' } : { data: [{ id: 'r1' }] }));
        });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const c = new CigalPay({ apiKey: 'k-123', merchantApiUrl: `http://127.0.0.1:${server.address().port}/` });
    try {
        const res = await c.createRefund({ paymentId: 'p-1', checkoutAmount: 9.98, customerEmail: 'c@example.com', reason: 'Returned item' });
        assert.equal(res.link, 'https://pay/refund/t');
        assert.deepEqual(seen[0], { method: 'POST', url: '/api/refunds', key: 'k-123', body: { paymentId: 'p-1', checkoutAmount: 9.98, customerEmail: 'c@example.com', reason: 'Returned item' } });

        const list = await c.getRefunds('p 1');
        assert.equal(list.data.length, 1);
        assert.deepEqual(seen[1], { method: 'GET', url: '/api/refunds?paymentId=p%201', key: 'k-123', body: undefined });

        await assert.rejects(c.createRefund({ paymentId: 'p-1', checkoutAmount: 49.9 }), (e) => e instanceof CigalPayError && e.status === 400 && /at most 35/.test(e.message));
    } finally {
        server.close();
    }
});

test('createRefund checks its input before any request', () => {
    assert.throws(() => new CigalPay().createRefund({ paymentId: 'p', amount: 1 }), /pass `apiKey`/);
    const c = new CigalPay({ apiKey: 'k' });
    assert.throws(() => c.createRefund({ amount: 1 }), /needs `paymentId`/);
    assert.throws(() => c.createRefund({ paymentId: 'p' }), /either `amount` or `checkoutAmount`/);
    assert.throws(() => c.createRefund({ paymentId: 'p', amount: 1, checkoutAmount: 1 }), /either `amount` or `checkoutAmount`/);
});
