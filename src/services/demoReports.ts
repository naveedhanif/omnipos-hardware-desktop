import type { DemoBusinessService } from './demoBusinessService';
import { money } from '../money.ts';
export interface DemoReportQuery {
    search: string;
    from: string;
    to: string;
    page: number;
}
export const defaultReportQuery: DemoReportQuery = { search: '', from: '', to: '', page: 1 };
export const demoReportNames = ['Sales register', 'Purchase register', 'Inventory valuation', 'Supplier statement'];
export function buildDemoReport(name: string, service: DemoBusinessService, query: DemoReportQuery) {
    if (!demoReportNames.includes(name))
        throw new Error('Unknown demo report.');
    if (!Number.isSafeInteger(query.page) || query.page < 1 || query.search.length > 160)
        throw new Error('Invalid report filter.');
    for (const date of [query.from, query.to])
        if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))
            throw new Error('Enter valid report dates.');
    if (query.from && query.to && query.from > query.to)
        throw new Error('The end date must not be before the start date.');
    const data = service.read();
    let columns: string[] = [], rows: {
        date: string;
        cells: string[];
    }[] = [];
    if (name === 'Sales register') {
        columns = ['Reference', 'Date', 'Customer at sale', 'Mode', 'Net (KWD)', 'Status'];
        rows = data.sales.map(s => ({ date: s.date.slice(0, 10), cells: [s.reference, s.date.slice(0, 10), s.customer, s.payment, money(s.total / 1000), s.refunded ? 'Demo reversed' : 'Demo recorded'] }));
    }
    if (name === 'Purchase register' || name === 'Supplier statement') {
        if (!service.canPurchase())
            throw new Error('Owner or administrator access is required for this purchasing report.');
        columns = ['Order', 'Date', 'Supplier at order', 'Lines', 'Order value (KWD)', 'Status', 'Invoice draft'];
        rows = data.orders.map(o => ({ date: o.date.slice(0, 10), cells: [o.reference, o.date.slice(0, 10), o.supplier, String(o.lines.length), money(o.lines.reduce((n, l) => n + Math.round(l.qty * l.price * 1000), 0) / 1000), `Demo ${o.status}`, o.invoiceReference ?? 'Not linked'] }));
    }
    if (name === 'Inventory valuation') {
        columns = ['SKU', 'Product', 'Quantity', 'Unit', 'Cost (KWD)', 'Sample value (KWD)', 'Status'];
        rows = data.products.map(p => ({ date: '', cells: [p.sku, p.name, p.stock_qty === null ? 'Unknown' : String(p.stock_qty), p.uom, money(p.cost_price), p.stock_qty === null ? 'Unavailable' : money(Math.round(p.stock_qty * p.cost_price * 1000) / 1000), p.is_active ? 'Active' : 'Archived'] }));
    }
    const search = query.search.trim().toLowerCase();
    const filtered = rows.filter(row => (!search || row.cells.some(cell => cell.toLowerCase().includes(search))) && (!row.date || (!query.from || row.date >= query.from) && (!query.to || row.date <= query.to)));
    const total = filtered.length, totalPages = Math.max(1, Math.ceil(total / 20)), page = Math.min(query.page, totalPages);
    return { columns, rows: filtered.slice((page - 1) * 20, page * 20).map(row => row.cells), total, page, totalPages, pageSize: 20, allRows: filtered.map(row => row.cells), dated: name !== 'Inventory valuation' };
}
