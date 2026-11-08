import { decodeStartup, record, resolveHardwareScope, uuid } from '../src/integration/decoders.ts';
import type { HardwareReadScope } from '../src/integration/contracts.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { directoryForPath, projectHardwareDirectory } from '../src/integration/hardwareDirectories.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { allowedReadPath, limitedText } from '../src/integration/readBoundary.ts';
export interface ProxyInput {
    method: string;
    path: string;
    authorization?: string;
    apiOrigin?: string;
}
export interface ProxyResult {
    status: number;
    body: string;
}
const fail = (status: number, code: string): ProxyResult => ({ status, body: JSON.stringify({ error: 'Read-only connection check could not complete.', code }) });
const capabilityCodes: Readonly<Record<string, readonly string[]>> = {
    '/api/hardware/supplier-invoices': ['AP_FEATURE_DISABLED', 'AP_SCHEMA_UNAVAILABLE'],
    '/api/hardware/supplier-invoices/reports/rate-differences': ['AP_FEATURE_DISABLED', 'AP_SCHEMA_UNAVAILABLE'],
    '/api/hardware/supplier-returns': ['HARDWARE_RETURNS_UNAVAILABLE'],
};
export const upstreamReadTimeoutMs = 60000;
/** Injectable fetch; tests never contact the approved deployment. */
export async function proxyRead(input: ProxyInput, fetcher: typeof fetch): Promise<ProxyResult> {
    if (input.method !== 'GET')
        return fail(405, 'READ_ONLY_METHOD');
    if (!allowedReadPath(input.path))
        return fail(404, 'READ_PATH_NOT_ALLOWED');
    const { authorization } = input;
    if (!authorization || !/^Bearer [A-Za-z0-9._~-]{1,8192}$/.test(authorization))
        return fail(401, 'SESSION_REQUIRED');
    if (input.apiOrigin?.replace(/\/$/, '') !== hardwareTargets.apiOrigin)
        return fail(503, 'PROXY_TARGET_NOT_CONFIGURED');
    try {
        const route = new URL(input.path, hardwareTargets.apiOrigin);
        const directory = directoryForPath(route.pathname);
        const tillCheck = route.pathname === '/api/hardware/till/active';
        const signal = AbortSignal.timeout(upstreamReadTimeoutMs);
        const upstream = (path: string) => fetcher(hardwareTargets.apiOrigin + path, {
            method: 'GET', headers: { Authorization: authorization, Accept: 'application/json' },
            redirect: 'error', cache: 'no-store', signal,
        });
        let upstreamPath = input.path, directoryScope: HardwareReadScope | undefined;
        if (directory || tillCheck) {
            const startup = await upstream('/api/startup-context');
            if (!startup.ok)
                return fail([401, 403].includes(startup.status) ? startup.status : 502, 'UPSTREAM_READ_REFUSED');
            if (!startup.headers.get('content-type')?.toLowerCase().includes('application/json'))
                return fail(502, 'UPSTREAM_INVALID_RESPONSE');
            const payload = record(JSON.parse(await limitedText(startup)));
            const userId = record(payload.user).id, storeId = route.searchParams.get('storeId')!;
            if (!uuid(userId))
                return fail(502, 'UPSTREAM_INVALID_RESPONSE');
            const context = decodeStartup(payload, userId);
            try {
                directoryScope = resolveHardwareScope(context, storeId, 0);
            }
            catch {
                return fail(403, 'UPSTREAM_READ_REFUSED');
            }
            if (directory && directory !== 'categories' && !['owner', 'admin'].includes(context.profile!.role.toLowerCase()))
                return fail(403, 'UPSTREAM_READ_REFUSED');
            upstreamPath = `${route.pathname}?${new URLSearchParams({ storeId })}`;
        }
        const response = await upstream(upstreamPath);
        const reviewedCodes = capabilityCodes[route.pathname];
        if (!response.ok && response.status === 503 && reviewedCodes && response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
            // Preserve only route-specific reviewed capability diagnostics, never upstream exception text.
            const body = JSON.parse(await limitedText(response, 16384));
            if (body && body.success === false && reviewedCodes.includes(body.code)) {
                const safe = fail(503, body.code);
                return { ...safe, body: JSON.stringify({ ...JSON.parse(safe.body), ...(uuid(body.correlationId) ? { correlationId: body.correlationId } : {}) }) };
            }
        }
        if (!response.ok)
            return fail([401, 403, 404, 429, 503].includes(response.status) ? response.status : 502, 'UPSTREAM_READ_REFUSED');
        if (!response.headers.get('content-type')?.toLowerCase().includes('application/json'))
            return fail(502, 'UPSTREAM_INVALID_RESPONSE');
        const body = await limitedText(response);
        const payload = JSON.parse(body);
        if (directory && directoryScope) {
            const page = projectHardwareDirectory(directory, payload, directoryScope, Number(route.searchParams.get('page')), route.searchParams.get('search') ?? '');
            return { status: 200, body: JSON.stringify(page) };
        }
        if (tillCheck) {
            if (payload?.demoFallback !== false)
                return fail(502, 'UPSTREAM_INVALID_RESPONSE');
            const till = payload.session;
            if (till !== null && (!uuid(till?.id) || till.store_id !== route.searchParams.get('storeId') || till.status !== 'open'))
                return fail(502, 'UPSTREAM_INVALID_RESPONSE');
            return { status: 200, body: JSON.stringify({ open: till !== null }) };
        }
        return { status: 200, body };
    }
    catch (error) {
        return fail(502, error instanceof Error && error.name === 'TimeoutError' ? 'UPSTREAM_READ_TIMEOUT' : 'UPSTREAM_READ_UNCONFIRMED');
    }
}
export async function readOnlyHandler(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET')
        res.setHeader('Allow', 'GET');
    const result = await proxyRead({ method: req.method ?? '', path: req.url ?? '', authorization: req.headers.authorization, apiOrigin: process.env.VITE_OMNIPOS_API_ORIGIN }, fetch);
    res.statusCode = result.status;
    res.end(result.body);
}
