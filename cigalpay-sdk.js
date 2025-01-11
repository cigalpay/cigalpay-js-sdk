class CigalpaySDK {

    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    async request(method, endpoint, data = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'cigalpay-api-key': this.apiKey
        };

        const options = {
            method,
            headers
        };

        if (method !== 'GET' && Object.keys(data).length) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        return response.json();
    }

    createPayment(amount, currency, extraId, ipnCallbackUrl, invoiceCallbackUrl) {
        return this.request('POST', '/createPayment', {
            amount,
            currency,
            extraId,
            ipnCallbackUrl,
            invoiceCallbackUrl
        });
    }

    getInvoiceStatus(invoiceId) {
        return this.request('GET', `/getInvoiceStatus?invoiceId=${encodeURIComponent(invoiceId)}`);
    }

    getPaymentStatus(id) {
        return this.request('GET', `/getPaymentStatus?id=${encodeURIComponent(id)}`);
    }

    getPaymentsByExtraId(extraId) {
        return this.request('GET', `/getPaymentsByExtraId?extraId=${encodeURIComponent(extraId)}`);
    }

    getActivePayments() {
        return this.request('GET', '/activePayments');
    }
}

// Exporting for use with NPM and CDN
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CigalpaySDK;
}

if (typeof window !== 'undefined') {
    window.CigalpaySDK = CigalpaySDK;
}