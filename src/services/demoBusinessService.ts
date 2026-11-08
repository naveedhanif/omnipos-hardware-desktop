import { parseProductCsv } from './demoCsv.ts';
import type { HardwareProduct, InvoiceDraft } from './contracts';
import { productsForWorkspace } from './sampleHardwareService.ts';
import { assertDemoContext, workspaceDetails, type WorkspaceContext } from '../workspace/context.ts';
import { totals } from '../money.ts';
import type { LocalStoragePort } from './demoAdministration.ts';
export interface DemoTaxonomy {
    id: string;
    name: string;
    active: boolean;
}
export interface DemoParty {
    id: string;
    name: string;
    contact: string;
    active?: boolean;
}
export interface DemoLine {
    productId: string;
    name: string;
    qty: number;
    price: number;
    discount: number;
    unitCost: number;
}
export interface DemoSale {
    customerId?: string;
    id: string;
    reference: string;
    customer: string;
    date: string;
    payment: string;
    lines: DemoLine[];
    gross: number;
    discount: number;
    charge: number;
    total: number;
    refunded: boolean;
}
export interface DemoPurchaseReceiptLine {
    productId: string;
    delivered: number;
    damaged: number;
    rejected: number;
    quarantined: number;
}
export interface DemoPurchaseReceipt {
    id: string;
    reference: string;
    date: string;
    lines: DemoPurchaseReceiptLine[];
}
export interface DemoOrder {
    supplierId?: string;
    id: string;
    reference: string;
    supplier: string;
    date: string;
    expectedDeliveryDate?: string;
    notes?: string;
    lines: (DemoLine & {
        receivedQty?: number;
    })[];
    status: 'draft' | 'partial' | 'received';
    receipts?: DemoPurchaseReceipt[];
    invoiceReference: string | null;
}
export interface DemoMovement {
    id: string;
    productId: string;
    date: string;
    reference: string;
    type: string;
    quantity: number;
}
export interface DemoReceipt {
    reversed?: boolean;
    reversalReason?: string;
    reversalDate?: string;
    id: string;
    saleId: string;
    reference: string;
    amount: number;
}
export interface DemoBusinessState {
    version: 1;
    organizationId: string;
    storeId: string;
    products: HardwareProduct[];
    catalogue?: {
        categories: DemoTaxonomy[];
        units: DemoTaxonomy[];
    };
    customers: DemoParty[];
    suppliers: DemoParty[];
    sales: DemoSale[];
    orders: DemoOrder[];
    movements: DemoMovement[];
    receipts: DemoReceipt[];
    till: {
        open: boolean;
        opening: number;
    };
}
const text = (value: string, max = 120) => {
    const v = value.trim();
    if (!v || v.length > max)
        throw new Error(`Enter 1 to ${max} characters.`);
    return v;
};
function calendarDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function draftOrderDetails(input: Pick<DemoOrder, 'expectedDeliveryDate' | 'notes'>) {
    const expectedDeliveryDate = input.expectedDeliveryDate?.trim() || undefined;
    const notes = input.notes?.trim() || undefined;
    if (expectedDeliveryDate && !calendarDate(expectedDeliveryDate))
        throw new Error('Enter a valid expected delivery date.');
    if (notes && notes.length > 1000)
        throw new Error('Use at most 1000 characters for purchase order notes.');
    return { expectedDeliveryDate, notes };
}
const amount = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 100000 || Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6)
        throw new Error('Use a non-negative amount with up to 3 decimal places.');
    return Math.round(value * 1000);
};
const now = () => new Date().toISOString();
function validateStoredBusiness(value: DemoBusinessState) {
    const fail = (): never => { throw new Error('Local store records are invalid. No changes were made.'); };
    const id = (v: unknown) => typeof v === 'string' && /^[-\w]{1,120}$/.test(v);
    const label = (v: unknown, max = 160) => typeof v === 'string' && v.length > 0 && v.length <= max;
    const minor = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
    const decimal = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000;
    const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
    const unique = (rows: unknown[], key: (row: any) => unknown) => {
        if (rows.length > 10000 || new Set(rows.map(key)).size !== rows.length)
            fail();
    };
    unique(value.products, p => p.id);
    unique(value.products, p => p.sku.toLowerCase());
    for (const p of value.products) {
        if (!label(p.name, 120) || !label(p.sku, 64) || !label(p.uom, 24) || !decimal(p.cost_price) || !decimal(p.sell_price) || typeof p.is_active !== 'boolean' || typeof p.track_inventory !== 'boolean' || typeof p.allow_decimal_qty !== 'boolean' || (p.stock_qty !== null && (!Number.isFinite(p.stock_qty) || p.stock_qty < 0)) || (p.category !== null && (!p.category || !label(p.category.name, 120))))
            fail();
    }
    for (const parties of [value.customers, value.suppliers]) {
        unique(parties, p => p.id);
        for (const p of parties)
            if (!id(p.id) || !label(p.name, 120) || !label(p.contact, 254) || (p.active !== undefined && typeof p.active !== 'boolean'))
                fail();
    }
    const lines = (rows: DemoLine[]) => {
        if (!Array.isArray(rows) || !rows.length || rows.length > 1000)
            fail();
        for (const l of rows) {
            if (!id(l.productId) || !value.products.some(p => p.id === l.productId) || !label(l.name, 120) || !decimal(l.qty) || l.qty === 0 || !decimal(l.price) || !decimal(l.unitCost) || !Number.isFinite(l.discount) || l.discount < 0 || l.discount > 100)
                fail();
        }
    };
    if (value.catalogue)
        for (const items of [value.catalogue.categories, value.catalogue.units]) {
            if (!Array.isArray(items))
                fail();
            unique(items, t => t.id);
            unique(items, t => t.name.toLowerCase());
            for (const item of items)
                if (!id(item.id) || !label(item.name, 80) || typeof item.active !== 'boolean')
                    fail();
        }
    unique(value.sales, s => s.id);
    unique(value.sales, s => s.reference);
    for (const sale of value.sales) {
        if (!id(sale.id) || !label(sale.reference, 100) || !label(sale.customer, 120) || !date(sale.date) || !['Account', 'Cash', 'Card'].includes(sale.payment) || typeof sale.refunded !== 'boolean' || ![sale.gross, sale.discount, sale.charge, sale.total].every(minor) || sale.total !== sale.gross - sale.discount + sale.charge)
            fail();
        lines(sale.lines);
        if (sale.gross !== sale.lines.reduce((n, l) => n + Math.round(l.qty * l.price * 1000), 0) || sale.discount !== sale.lines.reduce((n, l) => n + Math.round(l.qty * l.price * l.discount / 100 * 1000), 0))
            fail();
    }
    unique(value.orders, o => o.id);
    unique(value.orders, o => o.reference);
    for (const order of value.orders) {
        if (!id(order.id) || !label(order.reference, 100) || !label(order.supplier, 120) || !date(order.date) || !['draft', 'partial', 'received'].includes(order.status) || (order.invoiceReference !== null && !label(order.invoiceReference, 100)))
            fail();
        if (order.notes !== undefined && (typeof order.notes !== 'string' || order.notes.length > 1000) ||
            order.expectedDeliveryDate !== undefined && !calendarDate(order.expectedDeliveryDate))
            fail();
        lines(order.lines);
        if (order.lines.some(l => l.receivedQty !== undefined && (!Number.isFinite(l.receivedQty) || l.receivedQty < 0 || l.receivedQty > l.qty)))
            fail();
        if (order.receipts !== undefined) {
            if (!Array.isArray(order.receipts))
                fail();
            unique(order.receipts, r => r.id);
            unique(order.receipts, r => r.reference);
            for (const r of order.receipts) {
                if (!id(r.id) || !label(r.reference, 100) || !date(r.date) || !Array.isArray(r.lines) || !r.lines.length)
                    fail();
                for (const l of r.lines)
                    if (!order.lines.some(ol => ol.productId === l.productId) || ![l.delivered, l.damaged, l.rejected, l.quarantined].every(decimal) || l.delivered <= 0 || l.damaged + l.rejected + l.quarantined > l.delivered + 1e-6)
                        fail();
            }
        }
    }
    unique(value.movements, m => m.id);
    for (const m of value.movements)
        if (!id(m.id) || !value.products.some(p => p.id === m.productId) || !date(m.date) || !label(m.reference, 160) || !label(m.type) || !Number.isFinite(m.quantity))
            fail();
    unique(value.receipts, r => r.id);
    unique(value.receipts, r => r.reference);
    for (const r of value.receipts)
        if (!id(r.id) || !value.sales.some(s => s.id === r.saleId && s.payment === 'Account' && (!s.refunded || r.reversed === true)) || !label(r.reference, 100) || !minor(r.amount) || r.amount === 0 || (r.reversed !== undefined && typeof r.reversed !== 'boolean') || (r.reversed === true && (!label(r.reversalReason, 160) || !date(r.reversalDate))))
            fail();
    for (const sale of value.sales)
        if (value.receipts.filter(r => r.saleId === sale.id && !r.reversed).reduce((n, r) => n + r.amount, 0) > sale.total)
            fail();
    if (!minor(value.till.opening))
        fail();
}
export function createDemoBusinessService(context: WorkspaceContext, storage: LocalStoragePort) {
    assertDemoContext(context);
    const scope = { ...context }, details = workspaceDetails(scope), key = `hardware-demo:business:v1:${scope.organizationId}:${scope.storeId}`;
    function seed(): DemoBusinessState { return { version: 1, organizationId: scope.organizationId, storeId: scope.storeId, products: productsForWorkspace(scope), customers: [{ id: 'sample-customer-1', name: scope.organizationId === 'sample-organization-b' ? 'Harbour Site Services' : 'Al Noor Building Maintenance', contact: 'Not provided' }], suppliers: [{ id: 'sample-supplier-1', name: scope.organizationId === 'sample-organization-b' ? 'Harbour Industrial Supply' : 'Gulf Industrial Supplies', contact: 'Not provided' }], sales: [], orders: [], movements: [], receipts: [], till: { open: false, opening: 0 } }; }
    function decodeBusiness(raw: string): DemoBusinessState {
        const value = JSON.parse(raw) as DemoBusinessState;
        if (value.version !== 1 || value.organizationId !== scope.organizationId || value.storeId !== scope.storeId || !['products', 'customers', 'suppliers', 'sales', 'orders', 'movements', 'receipts'].every(k => Array.isArray((value as unknown as Record<string, unknown>)[k])) || !value.till || typeof value.till.open !== 'boolean' || !Number.isFinite(value.till.opening))
            throw new Error('This local store data is invalid. No changes were made.');
        if (value.products.some(p => p.store_id !== scope.storeId || typeof p.id !== 'string' || !/^[-\w]{1,120}$/.test(p.id) || typeof p.name !== 'string' || typeof p.sku !== 'string' || typeof p.uom !== 'string' || !Number.isFinite(p.cost_price) || !Number.isFinite(p.sell_price) || (p.stock_qty !== null && !Number.isFinite(p.stock_qty))))
            throw new Error('Invalid local product data.');
        validateStoredBusiness(value);
        for (const sale of value.sales)
            if (!sale.customerId)
                sale.customerId = value.customers.find(p => p.name === sale.customer)?.id;
        for (const order of value.orders) {
            if (!order.supplierId)
                order.supplierId = value.suppliers.find(p => p.name === order.supplier)?.id;
            for (const line of order.lines)
                if (line.receivedQty === undefined)
                    line.receivedQty = order.status === 'received' ? line.qty : 0;
        }
        return value;
    }
    function read(): DemoBusinessState { const raw = storage.getItem(key); return raw ? decodeBusiness(raw) : seed(); }
    function commit(value: DemoBusinessState) { validateStoredBusiness(value); storage.setItem(key, JSON.stringify(value)); }
    function manager() {
        if (!['Owner', 'Admin', 'Manager'].includes(details.organization.role))
            throw new Error('Demo manager access is required.');
    }
    function purchaser() {
        if (!['Owner', 'Admin'].includes(details.organization.role))
            throw new Error('This demo purchasing action requires owner or administrator access.');
    }
    function product(state: DemoBusinessState, id: string) {
        const p = state.products.find(p => p.id === id && p.store_id === scope.storeId && p.is_active);
        if (!p)
            throw new Error('Select an active product from this store.');
        return p;
    }
    function line(state: DemoBusinessState, input: {
        productId: string;
        qty: number;
        price: number;
        discount?: number;
    }): DemoLine {
        const p = product(state, input.productId);
        amount(input.price);
        if (!Number.isFinite(input.qty) || input.qty <= 0 || input.qty > 100000 || (!p.allow_decimal_qty && !Number.isInteger(input.qty)) || Math.abs(input.qty * 1000 - Math.round(input.qty * 1000)) > 1e-6)
            throw new Error('Enter a valid positive quantity for the product unit.');
        const discount = input.discount ?? 0;
        if (!Number.isFinite(discount) || discount < 0 || discount > 100)
            throw new Error('Discount must be between 0 and 100%.');
        return { productId: p.id, name: p.name, qty: input.qty, price: input.price, discount, unitCost: p.cost_price };
    }
    function movement(state: DemoBusinessState, p: HardwareProduct, quantity: number, reference: string, type: string) {
        if (p.track_inventory) {
            if (p.stock_qty === null)
                throw new Error('Stock availability is unknown. This demo movement is blocked.');
            p.stock_qty = Math.round((p.stock_qty + quantity) * 1000) / 1000;
        }
        state.movements.unshift({ id: crypto.randomUUID(), productId: p.id, date: now(), reference, type, quantity });
    }
    function balance(state: DemoBusinessState, sale: DemoSale) {
        if (sale.refunded || sale.payment !== 'Account')
            return 0;
        return sale.total - state.receipts.filter(r => r.saleId === sale.id && !r.reversed).reduce((n, r) => n + r.amount, 0);
    }
    function taxonomy(state: DemoBusinessState) {
        if (!state.catalogue)
            state.catalogue = { categories: [...new Set(state.products.flatMap(p => p.category ? [p.category.name] : []))].map((name, i) => ({ id: `seed-category-${i}`, name, active: true })), units: [...new Set(state.products.map(p => p.uom))].map((name, i) => ({ id: `seed-unit-${i}`, name, active: true })) };
        return state.catalogue;
    }
    function applyReceipt(state: DemoBusinessState, orderId: string, reference: string, input: DemoPurchaseReceiptLine[]) {
        const order = state.orders.find(o => o.id === orderId);
        if (!order)
            throw new Error('Select an order in this store.');
        reference = text(reference, 100);
        if (!Array.isArray(input) || !input.length || input.length > 100)
            throw new Error('Select at least one receipt line.');
        const rows = structuredClone(input).sort((a, b) => a.productId.localeCompare(b.productId));
        if (new Set(rows.map(r => r.productId)).size !== rows.length)
            throw new Error('Duplicate receipt product.');
        for (const other of state.orders) {
            const existing = other.receipts?.find(r => r.reference === reference);
            if (existing) {
                if (other.id === orderId && JSON.stringify(existing.lines) === JSON.stringify(rows))
                    return;
                throw new Error('Receipt reference was already used for another payload.');
            }
        }
        if (order.status === 'received')
            throw new Error('This demo order is already fully received.');
        for (const row of rows) {
            const original = order.lines.find(l => l.productId === row.productId), p = product(state, row.productId);
            if (!original)
                throw new Error('Receipt product is not in this order.');
            const values = [row.delivered, row.damaged, row.rejected, row.quarantined];
            if (values.some(v => !Number.isFinite(v) || v < 0 || v > 100000 || Math.abs(v * 1000 - Math.round(v * 1000)) > 1e-6 || (!p.allow_decimal_qty && !Number.isInteger(v))) || row.delivered <= 0 || row.damaged + row.rejected + row.quarantined > row.delivered + 1e-6)
                throw new Error('Enter valid delivered and disposition quantities.');
            if (row.delivered > original.qty - (original.receivedQty ?? 0) + 1e-6)
                throw new Error('Delivered quantity exceeds the remaining order quantity.');
        }
        for (const row of rows) {
            const original = order.lines.find(l => l.productId === row.productId)!, accepted = Math.round((row.delivered - row.damaged - row.rejected - row.quarantined) * 1000) / 1000;
            if (accepted > 0) {
                movement(state, product(state, row.productId), accepted, reference, 'Demo accepted receipt');
                original.receivedQty = Math.round(((original.receivedQty ?? 0) + accepted) * 1000) / 1000;
            }
        }
        (order.receipts ??= []).push({ id: crypto.randomUUID(), reference, date: now(), lines: rows });
        order.status = order.lines.every(l => (l.receivedQty ?? 0) >= l.qty) ? 'received' : order.lines.some(l => (l.receivedQty ?? 0) > 0) ? 'partial' : 'draft';
    }
    return {
        getTaxonomies() { const state = read(); return structuredClone(taxonomy(state)); },
        saveTaxonomy(kind: 'categories' | 'units', input: {
            id?: string;
            name: string;
            active?: boolean;
        }) {
            manager();
            if (!['categories', 'units'].includes(kind))
                throw new Error('Choose category or unit.');
            const state = read(), items = taxonomy(state)[kind], name = text(input.name, kind === 'units' ? 24 : 80);
            if (items.some(item => item.id !== input.id && item.name.toLowerCase() === name.toLowerCase()))
                throw new Error('That catalogue name already exists.');
            if (input.id) {
                const item = items.find(item => item.id === input.id);
                if (!item)
                    throw new Error('Catalogue entry not found.');
                const used = state.products.some(p => kind === 'categories' ? p.category?.name === item.name : p.uom === item.name);
                if (input.active === false && used)
                    throw new Error('This entry is used by a product. Reassign products before archiving it.');
                const old = item.name;
                item.name = name;
                if (input.active !== undefined)
                    item.active = input.active;
                for (const p of state.products) {
                    if (kind === 'units' && p.uom === old)
                        p.uom = name;
                    if (kind === 'categories' && p.category?.name === old)
                        p.category.name = name;
                }
            }
            else
                items.push({ id: crypto.randomUUID(), name, active: true });
            commit(state);
        },
        read, canPurchase: () => ['Owner', 'Admin'].includes(details.organization.role), listProducts: () => structuredClone(read().products),
        saveProduct(input: {
            id?: string;
            name: string;
            sku: string;
            barcode?: string;
            cost: number;
            price: number;
            unit: string;
            decimal: boolean;
            categoryId?: string;
        }) {
            manager();
            const state = read(), name = text(input.name), sku = text(input.sku, 64), unit = text(input.unit, 24);
            const barcode = input.barcode?.trim();
            if (barcode && (barcode.length > 64 || state.products.some(p => p.id !== input.id && p.barcode.toLowerCase() === barcode.toLowerCase())))
                throw new Error('Use a unique barcode of at most 64 characters.');
            amount(input.cost);
            amount(input.price);
            const catalogue = taxonomy(state);
            const knownUnit = catalogue.units.find(t => t.name.toLowerCase() === unit.toLowerCase());
            const effectiveUnit = knownUnit?.name ?? unit;
            if (knownUnit && !knownUnit.active)
                throw new Error('Choose an active unit.');
            if (!knownUnit)
                catalogue.units.push({ id: crypto.randomUUID(), name: unit, active: true });
            const category = input.categoryId ? catalogue.categories.find(t => t.id === input.categoryId && t.active) : null;
            if (input.categoryId && !category)
                throw new Error('Choose an active category in this store.');
            if (state.products.some(p => p.id !== input.id && p.sku.toLowerCase() === sku.toLowerCase()))
                throw new Error('That SKU already exists in this store.');
            if (input.id) {
                const p = product(state, input.id);
                if (!input.decimal && p.stock_qty !== null && !Number.isInteger(p.stock_qty))
                    throw new Error('Resolve fractional sample stock before changing to whole units.');
                if (input.categoryId !== undefined)
                    p.category = category ? { id: category.id, name: category.name } : null;
                Object.assign(p, { name, sku, cost_price: input.cost, sell_price: input.price, uom: effectiveUnit, allow_decimal_qty: input.decimal });
                if (barcode !== undefined)
                    p.barcode = barcode;
            }
            else
                state.products.push({ id: crypto.randomUUID(), store_id: scope.storeId, name, sku, barcode: barcode ?? '', cost_price: input.cost, sell_price: input.price, stock_qty: 0, uom: effectiveUnit, track_inventory: true, is_active: true, allow_decimal_qty: input.decimal, category: category ? { id: category.id, name: category.name } : null });
            commit(state);
        },
        importProducts(csv: string) {
            manager();
            const rows = parseProductCsv(csv), state = read(), seen = new Set(state.products.map(p => p.sku.toLowerCase()));
            for (const row of rows) {
                if (seen.has(row.sku.toLowerCase()))
                    throw new Error(`Duplicate SKU: ${row.sku}. No products imported.`);
                seen.add(row.sku.toLowerCase());
                const units = taxonomy(state).units, unit = units.find(t => t.name.toLowerCase() === row.unit.toLowerCase());
                if (unit && !unit.active)
                    throw new Error('Imported unit is archived.');
                if (!unit)
                    units.push({ id: crypto.randomUUID(), name: row.unit, active: true });
                state.products.push({ id: crypto.randomUUID(), store_id: scope.storeId, name: row.name, sku: row.sku, barcode: '', cost_price: row.cost, sell_price: row.price, stock_qty: 0, uom: row.unit, track_inventory: true, is_active: true, allow_decimal_qty: false, category: null });
            }
            commit(state);
            return rows.length;
        },
        archiveProduct(id: string) {
            manager();
            const state = read(), p = product(state, id);
            if (p.stock_qty === null || p.stock_qty !== 0 || state.orders.some(o => o.status !== 'received' && o.lines.some(l => l.productId === id)))
                throw new Error('Only zero-stock products without open demo orders can be archived.');
            p.is_active = false;
            commit(state);
        },
        reactivateProduct(id: string) { manager(); const state = read(), p = state.products.find(p => p.id === id); if (!p)
            throw new Error('Product not found in this store.'); p.is_active = true; commit(state); },
        saveParty(kind: 'customers' | 'suppliers', input: {
            id?: string;
            name: string;
            contact: string;
            active?: boolean;
        }) {
            manager();
            if (!['customers', 'suppliers'].includes(kind))
                throw new Error('Choose customer or supplier.');
            const state = read(), name = text(input.name), contact = input.contact.trim().slice(0, 254) || 'Not provided';
            if (state[kind].some(p => p.id !== input.id && p.name.toLowerCase() === name.toLowerCase()))
                throw new Error('That name already exists in this store.');
            if (input.id) {
                const party = state[kind].find(p => p.id === input.id);
                if (!party)
                    throw new Error('Contact is unavailable in this store.');
                if (input.active === false && (kind === 'suppliers' ? state.orders.some(o => (o.supplierId === party.id || o.supplier === party.name) && o.status !== 'received') : state.sales.some(s => (s.customerId === party.id || s.customer === party.name) && balance(state, s) > 0)))
                    throw new Error('Resolve open orders or outstanding balances before archiving this contact.');
                Object.assign(party, { name, contact });
                if (input.active !== undefined)
                    party.active = input.active;
            }
            else
                state[kind].push({ id: crypto.randomUUID(), name, contact, active: true });
            commit(state);
        },
        adjustStock(id: string, delta: number, reason: string) {
            manager();
            const state = read(), p = product(state, id);
            if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 100000 || (!p.allow_decimal_qty && !Number.isInteger(delta)) || Math.abs(delta * 1000 - Math.round(delta * 1000)) > 1e-6)
                throw new Error('Enter a valid non-zero quantity change.');
            if (p.stock_qty === null || p.stock_qty + delta < 0)
                throw new Error('Demo adjustment would create negative or unknown stock.');
            movement(state, p, delta, text(reason, 160), 'Demo adjustment');
            commit(state);
        },
        openTill(opening: number) {
            manager();
            const state = read();
            if (state.till.open)
                throw new Error('The demo till is already open.');
            state.till = { open: true, opening: amount(opening) };
            commit(state);
        },
        closeTill() {
            manager();
            const state = read();
            if (!state.till.open)
                throw new Error('The demo till is closed.');
            state.till.open = false;
            commit(state);
        },
        recordSale(draft: InvoiceDraft) {
            manager();
            const state = read(), reference = text(draft.document, 100);
            if (state.sales.some(s => s.reference === reference))
                throw new Error('This demo invoice reference is already recorded. Create a new invoice.');
            if (!draft.lines.length)
                throw new Error('Add at least one item.');
            if (!['Account', 'Cash', 'Card'].includes(draft.payment))
                throw new Error('Select a supported demo payment mode.');
            if (draft.payment !== 'Account' && !state.till.open)
                throw new Error('Open the demo till before simulating a cash or card sale.');
            const customer = state.customers.find(p => p.name === draft.customer);
            if (customer?.active === false || (!customer && draft.customer !== 'Walk-in customer'))
                throw new Error('Choose an active customer in this store.');
            const lines = draft.lines.map(l => {
                if (l.product.store_id !== scope.storeId)
                    throw new Error('Invoice item belongs to another store.');
                return line(state, { productId: l.product.id, qty: l.qty, price: l.price, discount: l.discount });
            });
            if (new Set(lines.map(l => l.productId)).size !== lines.length)
                throw new Error('Combine duplicate items before recording this demo.');
            for (const l of lines) {
                const p = product(state, l.productId);
                if (p.track_inventory && (p.stock_qty === null || p.stock_qty < l.qty))
                    throw new Error(`Insufficient or unknown sample stock for ${p.name}.`);
            }
            amount(draft.charge);
            const t = totals(draft.lines, draft.charge);
            const sale: DemoSale = { customerId: customer?.id, id: crypto.randomUUID(), reference, customer: text(draft.customer), date: now(), payment: draft.payment, lines, gross: Math.round(t.gross * 1000), discount: Math.round(t.discount * 1000), charge: Math.round(draft.charge * 1000), total: Math.round(t.net * 1000), refunded: false };
            for (const l of lines)
                movement(state, product(state, l.productId), -l.qty, reference, 'Demo sale');
            state.sales.unshift(sale);
            commit(state);
            return sale.id;
        },
        refundSale(id: string) {
            manager();
            const state = read(), sale = state.sales.find(s => s.id === id);
            if (!sale || sale.refunded)
                throw new Error('Choose a recorded demo sale that has not been reversed.');
            if (state.receipts.some(r => r.saleId === id && !r.reversed))
                throw new Error('This demo sale has allocations. Reverse its active allocations before reversing this demo sale.');
            for (const l of sale.lines) {
                const p = state.products.find(p => p.id === l.productId);
                if (!p || !p.is_active)
                    throw new Error('Reactivate the original product before reversing this demo sale.');
                movement(state, p, l.qty, sale.reference, 'Demo full reversal');
            }
            sale.refunded = true;
            commit(state);
        },
        createOrder(input: {
            reference: string;
            supplier: string;
            expectedDeliveryDate?: string;
            notes?: string;
            productId?: string;
            qty?: number;
            price?: number;
            lines?: {
                productId: string;
                qty: number;
                price: number;
            }[];
        }) {
            purchaser();
            const state = read(), reference = text(input.reference, 100), supplier = state.suppliers.find(p => p.name === input.supplier && p.active !== false);
            if (state.orders.some(o => o.reference === reference))
                throw new Error('That demo order reference exists.');
            if (!supplier)
                throw new Error('Select an active supplier in this store.');
            const entries = input.lines ?? [{ productId: input.productId ?? '', qty: input.qty ?? NaN, price: input.price ?? NaN }];
            if (!entries.length || entries.length > 100)
                throw new Error('Add between 1 and 100 purchase lines.');
            const lines = entries.map(entry => ({ ...line(state, entry), receivedQty: 0 }));
            if (new Set(lines.map(l => l.productId)).size !== lines.length)
                throw new Error('Combine duplicate purchase products.');
            state.orders.unshift({ supplierId: supplier.id, id: crypto.randomUUID(), reference, supplier: supplier.name, date: now(), ...draftOrderDetails(input), lines, status: 'draft', invoiceReference: null, receipts: [] });
            commit(state);
        },
        updateDraftOrder(id: string, input: Pick<DemoOrder, 'expectedDeliveryDate' | 'notes'>) {
            purchaser();
            const state = read(), order = state.orders.find(order => order.id === id);
            if (!order || order.status !== 'draft' || order.receipts?.length || order.lines.some(line => (line.receivedQty ?? 0) > 0))
                throw new Error('Only a demo order without receipts can be edited as a draft.');
            Object.assign(order, draftOrderDetails(input));
            commit(state);
        },
        receivePurchase(id: string, reference: string, lines: DemoPurchaseReceiptLine[]) { purchaser(); const state = read(); applyReceipt(state, id, reference, lines); commit(state); },
        receiveOrder(id: string) { purchaser(); const state = read(), order = state.orders.find(o => o.id === id); if (!order || order.status === 'received')
            throw new Error('Select an unreceived demo order.'); const lines = order.lines.filter(l => l.qty > (l.receivedQty ?? 0)).map(l => ({ productId: l.productId, delivered: Math.round((l.qty - (l.receivedQty ?? 0)) * 1000) / 1000, damaged: 0, rejected: 0, quarantined: 0 })); applyReceipt(state, id, `DEMO-RCV-${crypto.randomUUID().slice(0, 12)}`, lines); commit(state); },
        createSupplierInvoice(orderId: string, reference: string) {
            purchaser();
            const state = read(), order = state.orders.find(o => o.id === orderId);
            if (!order || order.status !== 'received' || order.invoiceReference)
                throw new Error('Select a received demo order without an invoice draft.');
            reference = text(reference, 100);
            if (state.orders.some(o => o.invoiceReference === reference))
                throw new Error('That invoice reference already exists.');
            order.invoiceReference = reference;
            commit(state);
        },
        recordAccountPayment(saleId: string, payment: number, reference: string) {
            manager();
            const state = read(), sale = state.sales.find(s => s.id === saleId), minor = amount(payment);
            reference = text(reference, 100);
            const existing = state.receipts.find(r => r.reference === reference);
            if (existing) {
                if (existing.reversed)
                    throw new Error('This allocation reference was reversed. Use a new reference.');
                if (existing.saleId === saleId && existing.amount === minor)
                    return;
                throw new Error('Payment reference was already used for a different demo allocation.');
            }
            if (!sale || minor <= 0 || minor > balance(state, sale))
                throw new Error('Enter an allocation greater than zero and no more than the sample balance.');
            state.receipts.push({ id: crypto.randomUUID(), saleId, reference, amount: minor });
            commit(state);
        },
        reverseAccountPayment(id: string, reason: string) { manager(); const state = read(), receipt = state.receipts.find(r => r.id === id); if (!receipt || receipt.reversed)
            throw new Error('Choose an unreversed local allocation.'); receipt.reversed = true; receipt.reversalReason = text(reason, 160); receipt.reversalDate = now(); commit(state); },
        balances() { const state = read(); return state.sales.filter(s => s.payment === 'Account').map(s => ({ saleId: s.id, reference: s.reference, customer: s.customer, total: s.total, outstanding: balance(state, s) })); },
        report() { const state = read(), active = state.sales.filter(s => !s.refunded); return { sales: active.length, revenue: active.reduce((n, s) => n + s.total, 0), discount: active.reduce((n, s) => n + s.discount, 0), cost: active.reduce((n, s) => n + s.lines.reduce((sum, l) => sum + Math.round(l.qty * l.unitCost * 1000), 0), 0), outstanding: state.sales.reduce((n, s) => n + balance(state, s), 0), stockValue: state.products.some(p => p.track_inventory && p.stock_qty === null) ? null : state.products.reduce((n, p) => n + Math.round((p.stock_qty ?? 0) * p.cost_price * 1000), 0) }; },
        previewBackup(source: string) { if (new TextEncoder().encode(source).length > 2000000)
            throw new Error('Use a local snapshot smaller than 2 MB.'); const state = decodeBusiness(source); return { products: state.products.length, sales: state.sales.length, orders: state.orders.length, allocations: state.receipts.length }; },
        restoreBackup(source: string, protectedSalesReferences: string[] = []) { manager(); if (new TextEncoder().encode(source).length > 2000000)
            throw new Error('Use a snapshot smaller than 2 MB.'); const candidate = decodeBusiness(source), current = read(); if (protectedSalesReferences.some(ref => !candidate.sales.some(s => s.reference === ref)))
            throw new Error('Snapshot would remove a sale linked to a local sales order. Restore was blocked.'); if (current.products.some(p => !candidate.products.some(c => c.id === p.id)))
            throw new Error('Snapshot would remove existing products referenced by other local drafts. Restore was blocked.'); commit(candidate); },
        exportBackup() { return JSON.stringify(read(), null, 2); },
    };
}
export type DemoBusinessService = ReturnType<typeof createDemoBusinessService>;
