import { escapeHtml as esc } from './html.ts';
import type { ReadResult } from '../integration/readResult.ts';
import type { RecordSaveFields, RecordSaveKind } from '../integration/desktopRecordSave.ts';

export function liveRecordSave(result: ReadResult, storeName: string, currency: string): string {
    if (result.kind !== 'categories' && result.kind !== 'products' && result.kind !== 'suppliers')
        return '';
    const kind = result.kind === 'categories' ? 'category' : result.kind === 'products' ? 'product' : 'supplier';
    const rows = result.kind === 'products' ? result.data.products : result.data.rows;
    return `<section class="access-panel" aria-labelledby="live-save-heading">
        <h2 id="live-save-heading">Save a ${kind}</h2>
        <p>Changes are saved to ${esc(storeName)}. To edit, choose a record from the loaded page.</p>
        <form id="live-record-save" class="operation-form" data-kind="${kind}">
            <div class="settlement-inputs">
                <label>Record<select name="id"><option value="">Create new ${kind}</option>
                    ${rows.map(row => `<option value="${esc(row.id)}">${esc(row.name)}</option>`).join('')}
                </select></label>
                <label>Name<input name="name" required maxlength="120"></label>
                ${kind === 'product' ? `<label>SKU<input name="sku" required maxlength="64"></label>
                    <label>Barcode<input name="barcode" maxlength="64"></label>
                    <label>Cost (${esc(currency)})<input name="cost" inputmode="decimal" required maxlength="11"></label>
                    <label>Selling price (${esc(currency)})<input name="price" inputmode="decimal" required maxlength="11"></label>
                    <label>Category ID (optional)<input name="categoryId" maxlength="36"></label>` : ''}
                ${kind === 'supplier' ? '<label>Supplier code (new suppliers)<input name="supplierCode" maxlength="64" required></label>' : ''}
            </div>
            <button class="button primary">Save ${kind}</button>
        </form>
        ${kind === 'product' ? '<p class="section-footnote">New items use Each. Copy an existing category ID from Categories to assign it. Leaving the category field blank keeps the current category on edits.</p>' : ''}
        ${kind === 'category' && rows.length ? `<details><summary>Category IDs for product entry</summary><ul>${rows.map(row => `<li>${esc(row.name)} <code>${esc(row.id)}</code></li>`).join('')}</ul></details>` : ''}
    </section>`;
}

export function bindLiveRecordSave(root: ParentNode, result: ReadResult, submit: (kind: RecordSaveKind, fields: RecordSaveFields) => void) {
    const form = root.querySelector<HTMLFormElement>('#live-record-save');
    if (!form)
        return;
    const id = form.elements.namedItem('id') as HTMLSelectElement;
    const input = (key: string) => form.elements.namedItem(key) as HTMLInputElement | null;
    id.addEventListener('change', () => {
        const rows = result.kind === 'products' ? result.data.products : result.kind === 'categories' || result.kind === 'suppliers' ? result.data.rows : [];
        const row = rows.find(item => item.id === id.value);
        input('name')!.value = row?.name ?? '';
        const supplierCode = input('supplierCode');
        if (supplierCode) {
            supplierCode.disabled = !!row;
            supplierCode.required = !row;
            supplierCode.value = '';
        }
        if (result.kind === 'products') {
            const product = result.data.products.find(item => item.id === id.value);
            input('sku')!.value = product?.sku ?? '';
            input('barcode')!.value = product?.barcode ?? '';
            input('cost')!.value = product?.cost_price?.toString() ?? '';
            input('price')!.value = product?.sell_price?.toString() ?? '';
            input('categoryId')!.value = '';
        }
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        const value = (key: string) => String(data.get(key) ?? '').trim();
        submit(form.dataset.kind as RecordSaveKind, {
            id: value('id') || undefined, name: value('name'), sku: value('sku'), barcode: value('barcode'),
            cost: value('cost'), price: value('price'), categoryId: value('categoryId'), supplierCode: value('supplierCode'),
        });
    });
}
