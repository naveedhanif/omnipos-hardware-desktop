/** Public configuration preparation only. This module cannot initialize auth or send requests. */
export interface PublicConnectionCandidate {
    apiOrigin?: string;
    authProjectUrl?: string;
    frontendOrigin?: string;
    callbackUrl?: string;
    recoveryUrl?: string;
    transportMode?: 'same-origin-proxy' | 'cors';
    browserKeyConfigured?: boolean;
}
function httpsOrigin(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
    }
    catch {
        return false;
    }
}
export function inspectPublicConnection(candidate: PublicConnectionCandidate) {
    const missing: string[] = [];
    for (const [key, label] of [['apiOrigin', 'Approved OmniPOS API origin'], ['authProjectUrl', 'Matching Supabase Auth project URL'], ['frontendOrigin', 'New frontend production origin']] as const) {
        if (!candidate[key] || !httpsOrigin(candidate[key]!))
            missing.push(label);
    }
    for (const [key, label] of [['callbackUrl', 'Approved callback URL'], ['recoveryUrl', 'Approved password recovery URL']] as const) {
        try {
            const url = new URL(candidate[key] ?? '');
            if (url.protocol !== 'https:' || url.username || url.password || url.hash || !candidate.frontendOrigin || url.origin !== new URL(candidate.frontendOrigin).origin)
                missing.push(label);
        }
        catch {
            missing.push(label);
        }
    }
    if (!['same-origin-proxy', 'cors'].includes(candidate.transportMode ?? ''))
        missing.push('Approved proxy or CORS deployment arrangement');
    if (candidate.browserKeyConfigured !== true)
        missing.push('Browser-safe client key configured privately by the owner');
    return { missing, publicValuesProvided: missing.length === 0, liveSignInEnabled: false as const, liveApiEnabled: false as const, transactionPostingEnabled: false as const };
}
export const unconfiguredConnection = Object.freeze(inspectPublicConnection({}));
