import { uuid } from './decoders.ts';
/** Exact API allow-list shared by browser and server; no generic /api forwarding. */
export function allowedReadPath(path: string): boolean {
    if (!path.startsWith('/api/') || path.includes('#'))
        return false;
    const url = new URL(path, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid')
        return false;
    if (url.pathname === '/api/startup-context')
        return !url.search;
    if (!['/api/hardware/products', '/api/hardware/inventory/balances', '/api/hardware/sales/invoices'].includes(url.pathname))
        return false;
    const keys = [...url.searchParams.keys()];
    return keys.length === 3 && new Set(keys).size === 3 && keys.every(k => ['storeId', 'page', 'limit'].includes(k)) &&
        uuid(url.searchParams.get('storeId')) && url.searchParams.get('page') === '1' && url.searchParams.get('limit') === '10';
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
