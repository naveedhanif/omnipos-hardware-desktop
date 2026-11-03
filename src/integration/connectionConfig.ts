// Public deployment targets observed in the owner's Vercel settings, not credentials.
export const hardwareTargets = Object.freeze({
    apiOrigin: 'https://omnipos-hardware-pilot.onrender.com',
    authOrigin: 'https://esjbplouepusbzrrkfvs.supabase.co',
    frontendOrigin: 'https://omnipos-hardware-desktop.vercel.app',
});
export interface ConnectionConfig {
    apiOrigin: string;
    authOrigin: string;
    frontendOrigin: string;
    browserKey: string;
}
function origin(value: string | undefined): string {
    try {
        const url = new URL(value ?? '');
        if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
            return '';
        return url.origin;
    }
    catch {
        return '';
    }
}
export function isBrowserKey(key: string, authOrigin: string): boolean {
    if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key))
        return true;
    try {
        const parts = key.split('.');
        if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p)))
            return false;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.role === 'anon' && payload.ref === new URL(authOrigin).hostname.split('.')[0];
    }
    catch {
        return false;
    }
}
/** Pure validation. Does not read files, print a key, initialize auth or make requests. */
export function inspectConnectionConfig(env: Readonly<Record<string, string | undefined>>, currentOrigin: string) {
    const apiOrigin = origin(env.VITE_OMNIPOS_API_ORIGIN), authOrigin = origin(env.VITE_SUPABASE_URL);
    const frontendOrigin = origin(env.VITE_HARDWARE_FRONTEND_ORIGIN), browserKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
    const missing: string[] = [];
    if (apiOrigin !== hardwareTargets.apiOrigin)
        missing.push('VITE_OMNIPOS_API_ORIGIN must match the reviewed backend.');
    if (authOrigin !== hardwareTargets.authOrigin)
        missing.push('VITE_SUPABASE_URL must match the reviewed auth project.');
    if (!isBrowserKey(browserKey, authOrigin))
        missing.push('VITE_SUPABASE_ANON_KEY must be a matching browser-safe key.');
    if (env.VITE_HARDWARE_TRANSPORT_MODE !== 'same-origin-proxy')
        missing.push('VITE_HARDWARE_TRANSPORT_MODE must be same-origin-proxy.');
    const local = ['http://127.0.0.1:5173', 'http://localhost:5173'].includes(frontendOrigin);
    if (frontendOrigin !== currentOrigin || (!local && frontendOrigin !== hardwareTargets.frontendOrigin))
        missing.push('VITE_HARDWARE_FRONTEND_ORIGIN must match this reviewed frontend origin. Preview/custom domains need review.');
    return { missing, config: missing.length ? null : { apiOrigin, authOrigin, frontendOrigin, browserKey } as ConnectionConfig };
}
