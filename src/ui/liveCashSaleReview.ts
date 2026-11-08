import type { BackendStore, ReadProduct } from '../integration/contracts.ts';
import { cashPilotUnitPrice } from '../integration/cashCheckoutPilot.ts';
import { escapeHtml as esc } from './html.ts';

export interface CashSaleReview {
    productId: string;
    till: 'open' | 'closed' | null;
}

export function liveCashSaleReview(store: BackendStore, products: ReadProduct[], review: CashSaleReview, busy: boolean): string {
    if (store.business_type !== 'hardware' || store.currency !== 'KWD')
        return '';
    const eligible = products.flatMap(product => {
        const price = cashPilotUnitPrice(store, product);
        return price === null ? [] : [{ product, price }];
    });
    const selected = eligible.find(({ product }) => product.id === review.productId);
    const till = review.till === 'open' ? 'Open when last checked.' : review.till === 'closed' ? 'No open till when last checked.' : 'Check the till for this review.';
    return `<section class="access-panel" aria-labelledby="live-sale-heading">
        <h2 id="live-sale-heading">Cash sale review</h2>
        <p>Review one unit from ${esc(store.name)} at its recorded price. Posting is unavailable in this workspace.</p>
        ${eligible.length ? `<label>Product <select id="live-sale-product" ${busy ? 'disabled' : ''}>
            <option value="">Choose a loaded product</option>
            ${eligible.map(({ product }) => `<option value="${esc(product.id)}" ${product.id === selected?.product.id ? 'selected' : ''}>${esc(product.sku ? product.sku + ' · ' + product.name : product.name)}</option>`).join('')}
        </select></label>
        <button type="button" class="button" id="live-check-till" ${busy || !selected ? 'disabled' : ''}>${busy ? 'Checking till…' : 'Check open till'}</button>
        ${selected ? `<p role="status">Quantity: 1 · Recorded item price: KWD ${selected.price.toFixed(3)} · Till: ${till}</p>` : ''}`
        : '<p>This page has no items with one available unit and a valid KWD price.</p>'}
    </section>`;
}
