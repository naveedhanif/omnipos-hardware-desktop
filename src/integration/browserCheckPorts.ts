import { createClient } from '@supabase/supabase-js';
import type { ConnectionConfig } from './connectionConfig.ts';
import type { CheckPorts } from './connectionCheck.ts';
import { allowedReadPath, limitedText } from './readBoundary.ts';
import { AuthCheckError, projectAuthError } from './authCheckError.ts';
/** No provider is created until the explicit sign-in submission. */
export function createBrowserCheckPorts(config: ConnectionConfig, fetcher: typeof fetch = fetch): CheckPorts {
    return {
        async signIn(email, password, signal) {
            let sent = false;
            let failure: 'timeout' | 'network' | 'blocked' | null = null;
            const authFetch: typeof fetch = async (input, init) => {
                const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
                if (sent || init?.method !== 'POST' || url.origin !== config.authOrigin || url.pathname !== '/auth/v1/token' || url.search !== '?grant_type=password') {
                    failure ??= 'blocked';
                    throw new AuthCheckError('AUTH_REQUEST_BLOCKED');
                }
                sent = true;
                try {
                    return await fetcher(input, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), redirect: 'error', cache: 'no-store', credentials: 'omit' });
                }
                catch (error) {
                    failure ??= error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
                    throw new Error('The auth request could not complete.');
                }
            };
            let client: ReturnType<typeof createClient> | null = null;
            try {
                client = createClient(config.authOrigin, config.browserKey, {
                    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `hardware-read-check-${crypto.randomUUID()}` },
                    global: { fetch: authFetch },
                });
                const { data, error } = await client.auth.signInWithPassword({ email, password });
                if (error)
                    throw projectAuthError(error, failure);
                if (!data.session || !data.user || !data.session.expires_at)
                    throw new AuthCheckError('AUTH_RESPONSE_INVALID');
                return { userId: data.user.id, accessToken: data.session.access_token, expiresAt: data.session.expires_at * 1000 };
            }
            catch (error) {
                throw projectAuthError(error, failure);
            }
            finally {
                await client?.auth.stopAutoRefresh();
            }
        },
        async transport(request) {
            if (request.method !== 'GET' || !allowedReadPath(request.url))
                throw new Error('Only the approved read paths are available.');
            const response = await fetcher(request.url, { method: 'GET', headers: { ...request.headers, Accept: 'application/json' },
                credentials: 'omit', redirect: 'error', cache: 'no-store', signal: request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(70000)]) : AbortSignal.timeout(70000) });
            if (!response.headers.get('content-type')?.toLowerCase().includes('application/json'))
                throw new Error('The read-only API did not return JSON.');
            return { status: response.status, body: await limitedText(response) };
        },
    };
}
