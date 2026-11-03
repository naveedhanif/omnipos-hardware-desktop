import { uuid } from './decoders.ts';
const codes = new Set([
    'SESSION_REQUIRED', 'PROXY_TARGET_NOT_CONFIGURED', 'READ_PATH_NOT_ALLOWED', 'READ_ONLY_METHOD',
    'UPSTREAM_READ_TIMEOUT', 'UPSTREAM_READ_UNCONFIRMED', 'UPSTREAM_READ_REFUSED', 'UPSTREAM_INVALID_RESPONSE',
    'AP_FEATURE_DISABLED', 'AP_SCHEMA_UNAVAILABLE', 'HARDWARE_RETURNS_UNAVAILABLE',
    'HARDWARE_PURCHASE_READ_FORBIDDEN', 'HARDWARE_SALES_READ_FORBIDDEN', 'SERVICE_UNAVAILABLE',
]);
/** Only reviewed machine codes; arbitrary strings may contain records or credentials. */
export const projectReadCode = (v: unknown): string | undefined => typeof v === 'string' && codes.has(v) ? v : undefined;
export const projectReadReference = (v: unknown): string | undefined => uuid(v) ? v : undefined;
export const projectHttpStatus = (v: unknown): number | undefined => typeof v === 'number' && Number.isInteger(v) && v >= 100 && v <= 599 ? v : undefined;
