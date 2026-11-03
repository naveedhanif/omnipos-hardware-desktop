import { diagnosticText, type WorkspaceDiagnostic } from '../integration/workspaceDiagnostics.ts';
import { escapeHtml } from './html.ts';
export function workspaceDiagnosticPanel(diagnostic: WorkspaceDiagnostic | null): string {
    if (!diagnostic)
        return '';
    return `<details class="workspace-diagnostic" ${diagnostic.outcome === 'failed' ? 'open' : ''}><summary>Connection diagnostics · ${diagnostic.outcome}</summary><p>This summary stays in this page. You can copy its text for support; credentials, search terms and business records are excluded.</p><pre tabindex="0" aria-label="Safe connection diagnostic">${escapeHtml(diagnosticText(diagnostic))}</pre></details>`;
}
