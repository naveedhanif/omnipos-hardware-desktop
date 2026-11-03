import { projectReadCode, projectReadReference, projectHttpStatus } from '../integration/safeReadDiagnostics.ts';
import { HardwareReadError } from '../integration/contracts.ts';
import { AuthCheckError, projectAuthProviderCode, type AuthCheckCode } from '../integration/authCheckError.ts';
const authDescriptions: Record<AuthCheckCode, string> = {
    AUTH_INVALID_CREDENTIALS: 'Authentication did not accept this account sign-in. Check the email/password and that this is the same auth project as OmniPOS.',
    AUTH_EMAIL_NOT_CONFIRMED: 'The authentication provider requires email confirmation for this account.',
    AUTH_RATE_LIMITED: 'The authentication provider is rate limiting sign-in. Wait before trying again.',
    AUTH_CAPTCHA_REQUIRED: 'The authentication provider requires a CAPTCHA flow that this check does not yet support.',
    AUTH_MFA_REQUIRED: 'The authentication provider requires an additional verification step that this check does not yet support.',
    AUTH_ACCOUNT_UNAVAILABLE: 'This account is unavailable for sign-in. Its administrator must review its status.',
    AUTH_REQUEST_REJECTED: 'The authentication provider rejected the request. Confirm the browser-safe key and account configuration.',
    AUTH_PROVIDER_UNAVAILABLE: 'The authentication provider could not complete the request.',
    AUTH_TIMEOUT: 'The authentication request timed out before sign-in could be verified.',
    AUTH_NETWORK_UNCONFIRMED: 'The authentication request failed to complete. Network or browser policy may be blocking it.',
    AUTH_RESPONSE_INVALID: 'The authentication service did not return a usable account session.',
    AUTH_REQUEST_BLOCKED: 'The application blocked an authentication action outside the approved one-shot password check.',
};
/** Display only known messages and projected diagnostics, never raw provider/server exception text. */
export function connectionError(error: unknown): string {
    if (error instanceof AuthCheckError) {
        const code: AuthCheckCode = Object.hasOwn(authDescriptions, error.code) ? error.code : 'AUTH_RESPONSE_INVALID';
        const details = [code, projectHttpStatus(error.status) ? `HTTP ${error.status}` : '', projectAuthProviderCode(error.providerCode) ?? ''].filter(Boolean).join(' · ');
        return `${authDescriptions[code]} (${details}) No workspace or product read was started. No automatic retry was sent.`;
    }
    if (error instanceof HardwareReadError) {
        const details = [projectHttpStatus(error.status) ? `HTTP ${error.status}` : '', projectReadCode(error.code) ?? '', projectReadReference(error.correlationId) ? `reference ${error.correlationId}` : ''].filter(Boolean).join(' · ');
        const description = error.code === 'HARDWARE_RETURNS_UNAVAILABLE' ? 'The existing backend reports supplier returns are unavailable. No database setup or feature-flag change was attempted; this is not an empty returns list.' : error.code === 'AP_FEATURE_DISABLED' ? 'Supplier invoice and rate-difference reads are disabled by the existing backend. No feature flag was changed and no invoice count was inferred.' : error.code === 'AP_SCHEMA_UNAVAILABLE' ? 'The existing backend reports that supplier invoice storage or functions are unavailable. No database setup was attempted and this is not an empty invoice list.' : error.code === 'UPSTREAM_READ_TIMEOUT' ? 'The existing backend did not respond within 60 seconds. Check its hosting status before starting a new check.' : error.kind === 'unauthenticated' ? 'The backend could not verify this session. Confirm the auth project and backend configuration.' : error.kind === 'forbidden' ? 'The backend refused access for this account or store.' : error.kind === 'network' ? 'The read could not be confirmed because the connection failed or timed out.' : error.kind === 'invalid-response' || error.code === 'UPSTREAM_INVALID_RESPONSE' ? 'The backend response did not match the expected read contract.' : 'The authorized read could not be completed.';
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
