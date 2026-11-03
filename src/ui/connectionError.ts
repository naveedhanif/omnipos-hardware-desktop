import { HardwareReadError } from '../integration/contracts.ts';
/** Display only known messages and projected diagnostics, never raw provider/server exception text. */
export function connectionError(error: unknown): string {
    if (error instanceof HardwareReadError) {
        const details = [error.status ? `HTTP ${error.status}` : '', error.code && /^[\w.-]{1,160}$/.test(error.code) ? error.code : '', error.correlationId && /^[\w.-]{1,160}$/.test(error.correlationId) ? `reference ${error.correlationId}` : ''].filter(Boolean).join(' · ');
        const description = error.code === 'UPSTREAM_READ_TIMEOUT' ? 'The existing backend did not respond within 60 seconds. Check its hosting status before starting a new check.' : error.kind === 'unauthenticated' ? 'The backend could not verify this session. Confirm the auth project and backend configuration.' : error.kind === 'forbidden' ? 'The backend refused access for this account or store.' : error.kind === 'network' ? 'The read could not be confirmed because the connection failed or timed out.' : error.kind === 'invalid-response' || error.code === 'UPSTREAM_INVALID_RESPONSE' ? 'The backend response did not match the expected read contract.' : 'The authorized read could not be completed.';
        return `${description}${details ? ` (${details})` : ''} No automatic retry was sent.`;
    }
    const known = [
        'An active account with an existing Hardware store is required.',
        'Owner or administrator access is required for the invoice register.',
        'Inventory currency does not match the authorized store.',
        'Sign-in could not be verified. Check your account or contact your administrator.',
    ];
    return error instanceof Error && known.includes(error.message) ? error.message : 'The connection check could not be verified. Start a new check after confirming the configuration and account.';
}
