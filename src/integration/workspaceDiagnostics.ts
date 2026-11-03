import type { CheckPorts } from './connectionCheck.ts';
import type { LiveView } from './readOnlyWorkspace.ts';
import { HardwareReadError, type ReadErrorKind } from './contracts.ts';
import { AuthCheckError, type AuthCheckCode } from './authCheckError.ts';
import { projectHttpStatus, projectReadCode, projectReadReference } from './safeReadDiagnostics.ts';
export const diagnosticOperations = {
    signIn: 'Sign-in and workspace verification', products: 'Products', inventory: 'Stock balances',
    invoices: 'Sales invoices', receipts: 'Goods receipts', supplierInvoices: 'Supplier invoices',
    supplierReturns: 'Supplier returns', rateDifferences: 'Purchase rate differences',
} as const;
export type DiagnosticOperation = LiveView | 'signIn';
const authCodes = new Set<AuthCheckCode>(['AUTH_INVALID_CREDENTIALS', 'AUTH_EMAIL_NOT_CONFIRMED', 'AUTH_RATE_LIMITED', 'AUTH_CAPTCHA_REQUIRED', 'AUTH_MFA_REQUIRED', 'AUTH_ACCOUNT_UNAVAILABLE', 'AUTH_REQUEST_REJECTED', 'AUTH_PROVIDER_UNAVAILABLE', 'AUTH_TIMEOUT', 'AUTH_NETWORK_UNCONFIRMED', 'AUTH_RESPONSE_INVALID', 'AUTH_REQUEST_BLOCKED']);
const readKinds = new Set<ReadErrorKind>(['disabled', 'unauthenticated', 'not-ready', 'forbidden', 'scope-mismatch', 'identity-changed', 'invalid-response', 'http', 'network']);
export interface WorkspaceDiagnostic {
    operation: DiagnosticOperation;
    stage: 'sign-in' | 'workspace-check' | 'data-read';
    outcome: 'running' | 'completed' | 'failed';
    category: string | null;
    code: string | null;
    status: number | null;
    reference: string | null;
}
/** One sanitized operation in memory. No URLs, headers, payloads, messages, user/store identity or storage. */
export function createWorkspaceDiagnostics(ports: CheckPorts) {
    let revision = 0, current: WorkspaceDiagnostic | null = null;
    function mark(attempt: number, stage: WorkspaceDiagnostic['stage'], status?: number) {
        if (attempt !== revision || !current || current.outcome !== 'running')
            return;
        current.stage = stage;
        current.status = projectHttpStatus(status) ?? null;
    }
    return {
        ports: {
            ...ports,
            async signIn(email, password, signal) {
                const attempt = revision;
                mark(attempt, 'sign-in');
                return ports.signIn(email, password, signal);
            },
            async transport(request) {
                const attempt = revision, stage = request.url === '/api/startup-context' ? 'workspace-check' : 'data-read';
                mark(attempt, stage);
                const response = await ports.transport(request);
                mark(attempt, stage, response.status);
                return response;
            },
        } satisfies CheckPorts,
        begin(operation: DiagnosticOperation) {
            if (!Object.hasOwn(diagnosticOperations, operation))
                throw new Error('Unsupported diagnostic operation.');
            ++revision;
            current = { operation, stage: operation === 'signIn' ? 'sign-in' : 'workspace-check', outcome: 'running', category: null, code: null, status: null, reference: null };
            return revision;
        },
        finish(attempt: number, error?: unknown) {
            if (attempt !== revision || !current || current.outcome !== 'running')
                return;
            current.outcome = error === undefined ? 'completed' : 'failed';
            if (error === undefined)
                return;
            current.category = error instanceof AuthCheckError ? 'authentication' : error instanceof HardwareReadError && readKinds.has(error.kind) ? error.kind : 'unconfirmed';
            current.code = error instanceof AuthCheckError && authCodes.has(error.code) ? error.code : error instanceof HardwareReadError ? projectReadCode(error.code) ?? null : null;
            current.status = projectHttpStatus(error instanceof AuthCheckError || error instanceof HardwareReadError ? error.status : undefined) ?? current.status;
            current.reference = error instanceof HardwareReadError ? projectReadReference(error.correlationId) ?? null : null;
        },
        snapshot(): WorkspaceDiagnostic | null { return current ? { ...current } : null; },
        clear() { ++revision; current = null; },
    };
}
export function diagnosticRecovery(d: WorkspaceDiagnostic): string {
    if (d.outcome === 'running')
        return 'Wait for this attempt to finish. No automatic retry is sent.';
    if (d.outcome === 'completed')
        return 'The selected operation passed the frontend checks. This does not verify other views, roles or tenant isolation.';
    if (d.code === 'AUTH_RATE_LIMITED' || d.status === 429)
        return 'Wait for rate limiting to end before trying manually again.';
    if (['AP_FEATURE_DISABLED', 'AP_SCHEMA_UNAVAILABLE', 'HARDWARE_RETURNS_UNAVAILABLE'].includes(d.code ?? ''))
        return 'Ask the backend owner to review this capability. Do not enable posting or install database objects to bypass the read failure.';
    if (d.stage === 'sign-in')
        return 'Check the existing account sign-in and approved authentication configuration. Use the existing OmniPOS recovery flow if needed; do not share credentials.';
    if (d.category === 'forbidden' || d.category === 'scope-mismatch' || d.category === 'unauthenticated' || d.status === 401 || d.status === 403)
        return 'Ask the account administrator to verify active company/store access. Sign in again only after that review.';
    if (d.code === 'UPSTREAM_READ_TIMEOUT' || d.category === 'network')
        return 'Check backend hosting and network availability before starting another manual attempt.';
    if (d.stage === 'workspace-check')
        return 'Sign-in may have succeeded, but workspace verification did not complete. Ask the backend owner to check the startup route and deployment.';
    return 'Ask the backend owner to compare this read contract with the deployed API. No empty or sample result was substituted.';
}
export function diagnosticText(d: WorkspaceDiagnostic): string {
    return ['Hardware read-only diagnostic', `Operation: ${diagnosticOperations[d.operation]}`, `Stage: ${d.stage}`, `Outcome: ${d.outcome}`, d.category ? `Category: ${d.category}` : '', d.code ? `Code: ${d.code}` : '', d.status ? `HTTP: ${d.status}` : '', d.reference ? `Reference: ${d.reference}` : '', `Next step: ${diagnosticRecovery(d)}`].filter(Boolean).join('\n');
}
