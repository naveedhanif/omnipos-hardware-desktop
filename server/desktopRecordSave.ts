import type { IncomingMessage, ServerResponse } from 'node:http';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { decodeStartup, record, resolveHardwareScope, uuid } from '../src/integration/decoders.ts';
import { recordSaveRoutes, type RecordSaveKind } from '../src/integration/desktopRecordSave.ts';
import { limitedText } from '../src/integration/readBoundary.ts';
import { readOnlyHandler, type ProxyResult } from './readOnlyProxy.ts';

const response = (status: number, code: string): ProxyResult => ({ status, body: JSON.stringify({ code }) });
const uncertain = () => response(502, 'SAVE_UNCONFIRMED');

function requiredText(value: unknown, max: number): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
        throw new Error('Invalid text');
    return value.trim();
}

function amount(value: unknown, fractionDigits: number): string {
    if (typeof value !== 'string' || !/^\d{1,6}(?:\.\d{1,4})?$/.test(value) ||
        (value.split('.')[1]?.length ?? 0) > fractionDigits)
        throw new Error('Invalid price');
    return value;
}

function writePayload(kind: RecordSaveKind, input: Record<string, unknown>, storeId: string, fractionDigits: number) {
    const name = requiredText(input.name, 120);
    if (kind === 'category')
        return { storeId, name };
    if (kind === 'supplier')
        return { storeId, company_name: name, ...(input.id ? {} : { supplier_code: requiredText(input.supplierCode, 64), status: 'active' }) };
    const barcode = typeof input.barcode === 'string' && input.barcode.trim() === '' ? null : requiredText(input.barcode, 64);
    if (input.categoryId && !uuid(input.categoryId))
        throw new Error('Invalid category');
    return {
        storeId, name, sku: requiredText(input.sku, 64), barcode,
        cost_price: amount(input.cost, fractionDigits), sell_price: amount(input.price, fractionDigits),
        ...(input.categoryId ? { category_id: input.categoryId } : {}),
        ...(input.id ? {} : { track_inventory: true, allow_negative_stock: false, is_active: true }),
    };
}

export async function saveDesktopRecord(kind: RecordSaveKind, request: {
    origin?: string; authorization?: string; apiOrigin?: string; body: unknown;
}, fetcher: typeof fetch): Promise<ProxyResult> {
    const { authorization } = request;
    if (!authorization || !/^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(authorization))
        return response(401, 'SESSION_REQUIRED');
    if (request.origin !== hardwareTargets.frontendOrigin)
        return response(403, 'SAVE_REFUSED');
    if (request.apiOrigin?.replace(/\/$/, '') !== hardwareTargets.apiOrigin)
        return response(503, 'SAVE_REFUSED');
    let input: Record<string, unknown>;
    try {
        input = record(request.body);
        if (!uuid(input.storeId) || (input.id !== undefined && !uuid(input.id)))
            return response(400, 'SAVE_REFUSED');
        writePayload(kind, input, input.storeId, 4);
    } catch {
        return response(400, 'SAVE_REFUSED');
    }
    const storeId = input.storeId as string;
    const signal = AbortSignal.timeout(40000);
    const upstream = (path: string, init: RequestInit = {}) => fetcher(hardwareTargets.apiOrigin + path, {
        ...init,
        headers: { Authorization: authorization, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
        cache: 'no-store', redirect: 'error', signal,
    });
    let sent = false;
    try {
        const startup = await upstream('/api/startup-context');
        if (!startup.ok)
            return response(startup.status === 401 ? 401 : 403, 'SAVE_REFUSED');
        const contextBody = record(JSON.parse(await limitedText(startup, 200000)));
        const userId = record(contextBody.user).id;
        if (!uuid(userId))
            return response(403, 'SAVE_REFUSED');
        const context = decodeStartup(contextBody, userId);
        const scope = resolveHardwareScope(context, storeId, 0);
        if (!['owner', 'admin'].includes(context.profile!.role.toLowerCase()))
            return response(403, 'SAVE_REFUSED');
        const store = context.stores.find(candidate => candidate.id === storeId)!;
        const digits = new Intl.NumberFormat('en', { style: 'currency', currency: store.currency }).resolvedOptions().maximumFractionDigits;
        const payload = writePayload(kind, input, storeId, digits ?? 0);
        const path = recordSaveRoutes[kind] + (input.id ? '/' + input.id : '');
        sent = true;
        const result = await upstream(path, { method: input.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
        if (result.status === 409)
            return response(409, 'SAVE_CONFLICT');
        if (!result.ok)
            return uncertain();
        const body = record(JSON.parse(await limitedText(result, 64000)));
        const saved = record(body[kind]);
        if (body.success !== true || body.error || !uuid(saved.id) || (input.id && saved.id !== input.id) ||
            saved.store_id !== scope.storeId || saved.organization_id !== scope.organizationId)
            return uncertain();
        return { status: 200, body: JSON.stringify({ code: 'SAVED', id: saved.id }) };
    } catch {
        return sent ? uncertain() : response(403, 'SAVE_REFUSED');
    }
}

async function requestBody(req: IncomingMessage) {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json')
        throw new Error('Expected JSON');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 4096)
            throw new Error('Request too large');
        chunks.push(bytes);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function desktopRecordHandler(kind: RecordSaveKind) {
    return async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST' || req.url !== recordSaveRoutes[kind])
            return readOnlyHandler(req, res);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('CDN-Cache-Control', 'no-store');
        res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
        res.setHeader('Vary', 'Authorization, Origin');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        let result = response(401, 'SESSION_REQUIRED');
        if (req.headers.authorization && req.headers.origin !== hardwareTargets.frontendOrigin) {
            result = response(403, 'SAVE_REFUSED');
        } else if (req.headers.authorization) {
            try {
                result = await saveDesktopRecord(kind, {
                    origin: req.headers.origin, authorization: req.headers.authorization,
                    apiOrigin: process.env.VITE_OMNIPOS_API_ORIGIN, body: await requestBody(req),
                }, fetch);
            } catch {
                result = response(400, 'SAVE_REFUSED');
            }
        }
        res.statusCode = result.status;
        res.end(result.body);
    };
}
