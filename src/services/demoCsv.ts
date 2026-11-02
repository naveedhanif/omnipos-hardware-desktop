/** Bounded CSV helpers for local demo import/export. No network or database operations. */
export function safeCsv(rows: (string | number)[][]): string {
    return rows.map(row => row.map(value => { let text = String(value); if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text))
        text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }).join(',')).join('\r\n');
}
export interface ProductImportRow {
    sku: string;
    name: string;
    cost: number;
    price: number;
    unit: string;
}
export function parseProductCsv(source: string): ProductImportRow[] {
    if (new TextEncoder().encode(source).length > 500000)
        throw new Error('Use a CSV file smaller than 500 KB.');
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false, afterQuote = false;
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        if (quoted) {
            if (c === '"') {
                if (source[i + 1] === '"') {
                    cell += '"';
                    i++;
                }
                else {
                    quoted = false;
                    afterQuote = true;
                }
            }
            else
                cell += c;
            continue;
        }
        if (c === '"') {
            if (cell || afterQuote)
                throw new Error('Malformed CSV quoting.');
            quoted = true;
            continue;
        }
        if (c === ',' || c === '\n' || c === '\r') {
            row.push(cell);
            cell = '';
            afterQuote = false;
            if (c !== ',') {
                if (c === '\r' && source[i + 1] === '\n')
                    i++;
                if (row.some(value => value.trim()))
                    rows.push(row);
                row = [];
            }
            continue;
        }
        if (afterQuote)
            throw new Error('Unexpected text after a quoted CSV cell.');
        cell += c;
    }
    if (quoted)
        throw new Error('Unclosed CSV quote.');
    if (cell || afterQuote || row.length) {
        row.push(cell);
        if (row.some(value => value.trim()))
            rows.push(row);
    }
    const headers = rows.shift()?.map(value => value.replace(/^\uFEFF/, '').trim().toLowerCase());
    if (headers?.join(',') !== 'sku,name,cost_price,sell_price,uom')
        throw new Error('Use columns: sku,name,cost_price,sell_price,uom.');
    if (rows.length === 0 || rows.length > 100)
        throw new Error('Import between 1 and 100 sample products at a time.');
    return rows.map((row, index) => { if (row.length !== 5)
        throw new Error(`Row ${index + 2} must have five columns.`); const [sku, name, cost, price, unit] = row.map(value => value.trim()); if (!sku || !name || !unit || sku.length > 64 || name.length > 120 || unit.length > 24 || !/^\d+(\.\d{1,3})?$/.test(cost) || !/^\d+(\.\d{1,3})?$/.test(price) || Number(cost) > 100000 || Number(price) > 100000)
        throw new Error(`Row ${index + 2} has invalid product data. Use plain, non-negative prices with up to 3 decimals.`); return { sku, name, cost: Number(cost), price: Number(price), unit }; });
}
