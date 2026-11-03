import type { BackendStore, ReadProduct } from '../integration/contracts.ts';
import { escapeHtml as esc } from './html.ts';

function eligibleProducts(store: BackendStore, products: ReadProduct[]) {
    return products.filter(product =>
        product.store_id === store.id &&
        product.sell_price !== null && Number.isFinite(product.sell_price) && product.sell_price > 0 &&
        product.stock_qty !== null && product.stock_qty >= 1
    );
}

export function liveCashSaleReview(store: BackendStore, products: ReadProduct[]): string {
    const eligible = eligibleProducts(store, products);
    if (!eligible.length) return '';
    return `<section class="access-panel" aria-labelledby="live-sale-heading">
        <h2 id="live-sale-heading">Cash sale review</h2>
        <p>Review one unit from ${esc(store.name)} at its recorded price. Posting is unavailable until checkout permissions and till validation are verified.</p>
        <label>Product <select id="live-sale-product">
            <option value="">Choose a loaded product</option>
            ${eligible.map(product => `<option value="${esc(product.id)}">${esc(product.sku ? product.sku + ' · ' + product.name : product.name)}</option>`).join('')}
        </select></label>
        <p id="live-sale-total" role="status"></p>
    </section>`;
}

export function bindLiveCashSaleReview(root: ParentNode, store: BackendStore, products: ReadProduct[]) {
    const select = root.querySelector<HTMLSelectElement>('#live-sale-product');
    const total = root.querySelector<HTMLElement>('#live-sale-total');
    if (!select || !total) return;
    const eligible = eligibleProducts(store, products);
    select.addEventListener('change', () => {
        const product = eligible.find(item => item.id === select.value);
        total.textContent = product
            ? `Quantity: 1 · Recorded line amount before checkout validation: ${store.currency} ${product.sell_price}`
            : '';
    });
}
