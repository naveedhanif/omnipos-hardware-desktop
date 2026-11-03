export type AuthCheckCode = 'AUTH_INVALID_CREDENTIALS' | 'AUTH_EMAIL_NOT_CONFIRMED' | 'AUTH_RATE_LIMITED' | 'AUTH_CAPTCHA_REQUIRED' | 'AUTH_MFA_REQUIRED' | 'AUTH_ACCOUNT_UNAVAILABLE' | 'AUTH_REQUEST_REJECTED' | 'AUTH_PROVIDER_UNAVAILABLE' | 'AUTH_TIMEOUT' | 'AUTH_NETWORK_UNCONFIRMED' | 'AUTH_RESPONSE_INVALID' | 'AUTH_REQUEST_BLOCKED';
export class AuthCheckError extends Error {
    readonly code: AuthCheckCode;
    readonly status?: number;
    readonly providerCode?: string;
    constructor(code: AuthCheckCode, status?: number, providerCode?: string) {
        super('The authentication step could not be completed.');
        this.name = 'AuthCheckError';
        this.code = code;
        this.status = status;
        this.providerCode = providerCode;
    }
}
const providerCodes: Readonly<Record<string, AuthCheckCode>> = {
    invalid_credentials: 'AUTH_INVALID_CREDENTIALS', email_not_confirmed: 'AUTH_EMAIL_NOT_CONFIRMED',
    over_request_rate_limit: 'AUTH_RATE_LIMITED', over_email_send_rate_limit: 'AUTH_RATE_LIMITED',
    captcha_failed: 'AUTH_CAPTCHA_REQUIRED', insufficient_aal: 'AUTH_MFA_REQUIRED',
    user_banned: 'AUTH_ACCOUNT_UNAVAILABLE', user_not_found: 'AUTH_INVALID_CREDENTIALS',
};
/** Never copy provider messages, arbitrary codes, emails, response bodies or tokens. */
export function projectAuthError(error: unknown, failure?: 'timeout' | 'network' | 'blocked' | null): AuthCheckError {
    if (error instanceof AuthCheckError)
        return error;
    const data = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const status = typeof data.status === 'number' && Number.isInteger(data.status) && data.status >= 100 && data.status <= 599 ? data.status : undefined;
    if (failure)
        return new AuthCheckError(failure === 'timeout' ? 'AUTH_TIMEOUT' : failure === 'blocked' ? 'AUTH_REQUEST_BLOCKED' : 'AUTH_NETWORK_UNCONFIRMED', status);
    const known = typeof data.code === 'string' && Object.hasOwn(providerCodes, data.code) ? providerCodes[data.code] : undefined;
    if (known)
        return new AuthCheckError(known, status, data.code as string);
    return new AuthCheckError(status === 429 ? 'AUTH_RATE_LIMITED' : status && status >= 500 ? 'AUTH_PROVIDER_UNAVAILABLE' : status ? 'AUTH_REQUEST_REJECTED' : 'AUTH_RESPONSE_INVALID', status);
}
