import { uuid } from './decoders.ts';
import { directoryForPath } from './hardwareDirectories.ts';
import { readWindow } from './readWindow.ts';
/** Exact API allow-list shared by browser and server; no generic /api forwarding. */
export function allowedReadPath(path: string): boolean {
    if (!path.startsWith('/api/') || path.includes('#'))
        return false;
    const url = new URL(path, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid')
        return false;
    if (url.pathname === '/api/hardware/till/active')
        return [...url.searchParams.keys()].length === 1 && uuid(url.searchParams.get('storeId'));
    if (url.pathname === '/api/startup-context')
        return !url.search;
    if (!directoryForPath(url.pathname) && !['/api/hardware/products', '/api/hardware/inventory/balances', '/api/hardware/sales/invoices', '/api/hardware/goods-receipts', '/api/hardware/supplier-invoices', '/api/hardware/supplier-returns', '/api/hardware/supplier-invoices/reports/rate-differences'].includes(url.pathname))
        return false;
    if (url.pathname === '/api/hardware/supplier-invoices/reports/rate-differences' && url.searchParams.has('search'))
        return false;
    const keys = [...url.searchParams.keys()];
    if (keys.length < 3 || keys.length > 4 || new Set(keys).size !== keys.length || !keys.every(k => ['storeId', 'page', 'limit', 'search'].includes(k)) || !uuid(url.searchParams.get('storeId')) || url.searchParams.get('limit') !== '10')
        return false;
    const pageText = url.searchParams.get('page') ?? '';
    if (!/^[1-9]\d{0,4}$/.test(pageText))
        return false;
    try {
        const q = readWindow({ page: Number(pageText), search: url.searchParams.get('search') ?? '' });
        return !url.searchParams.has('search') || q.search.length > 0;
    }
    catch {
        return false;
    }
}
export async function limitedText(response: Response, maxBytes = 2000000): Promise<string> {
    if (!response.body)
        throw new Error('Empty response.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > maxBytes)
                throw new Error('Response too large.');
            chunks.push(value);
        }
    }
    catch (error) {
        await reader.cancel().catch(() => { });
        throw error;
    }
    finally {
        reader.releaseLock();
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
    }
    return new TextDecoder().decode(joined);
}
