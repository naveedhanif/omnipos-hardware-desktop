import type { LiveView, WorkspaceSummary } from '../integration/readOnlyWorkspace.ts';
import { escapeHtml as esc } from './html.ts';
export const liveViewLabels: Record<LiveView, string> = {
    products: 'Products', inventory: 'Stock balances', invoices: 'Invoice register',
    receipts: 'Goods receipts', supplierInvoices: 'Supplier invoices',
    supplierReturns: 'Supplier returns', rateDifferences: 'Purchase rate differences',
};
type Access = Pick<WorkspaceSummary, 'canReadInvoices' | 'canReadPurchasing'>;
export function enabledLiveViews(access: Access): LiveView[] {
    return (Object.keys(liveViewLabels) as LiveView[]).filter(key => key === 'products' || key === 'inventory' || (key === 'invoices' ? access.canReadInvoices : access.canReadPurchasing));
}
export function nextLiveView(current: LiveView, key: string, enabled: readonly LiveView[]): LiveView | null {
    if (!enabled.length || !enabled.includes(current))
        return null;
    const index = enabled.indexOf(current);
    if (key === 'Home')
        return enabled[0];
    if (key === 'End')
        return enabled[enabled.length - 1];
    if (key === 'ArrowRight')
        return enabled[(index + 1) % enabled.length];
    if (key === 'ArrowLeft')
        return enabled[(index + enabled.length - 1) % enabled.length];
    return null;
}
export function liveViewTabs(current: LiveView, access: Access, busy = false): string {
    const enabled = enabledLiveViews(access);
    return `<p id="live-tab-help" class="section-footnote">Use Left/Right arrows, Home or End to choose a view. Selecting a view does not load records.</p><div class="live-read-tabs" role="tablist" aria-label="Read-only views" aria-describedby="live-tab-help">${(Object.entries(liveViewLabels) as [
        LiveView,
        string
    ][]).map(([key, label]) => `<button type="button" role="tab" id="live-tab-${key}" aria-controls="live-view-panel" aria-selected="${key === current}" tabindex="${key === current && !busy && enabled.includes(key) ? 0 : -1}" data-live-view="${key}" ${busy || !enabled.includes(key) ? 'disabled' : ''}>${esc(label)}${key !== 'products' && key !== 'inventory' ? ' · owner/admin' : ''}</button>`).join('')}</div>`;
}
/** DOM binding has no service or transport: changing view can only notify the page. */
export function bindLiveViewTabs(root: ParentNode, select: (view: LiveView) => void) {
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-live-view]')];
    tabs.forEach(button => {
        button.addEventListener('click', () => { if (!button.disabled)
            select(button.dataset.liveView as LiveView); });
        button.addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || button.disabled)
                return;
            const enabled = tabs.filter(b => !b.disabled).map(b => b.dataset.liveView as LiveView);
            const next = nextLiveView(button.dataset.liveView as LiveView, event.key, enabled);
            if (!next)
                return;
            event.preventDefault();
            select(next);
        });
    });
}
/** All identifiers come from app controls, not user data. Safe when a control disappears or is disabled. */
export function focusLiveControl(root: ParentNode, id: string) {
    const element = root.querySelector<HTMLElement>(`#${id}`);
    if (!element || element.matches(':disabled'))
        return;
    element.focus({ preventScroll: true });
    if (element.getAttribute('role') === 'tab')
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
export function liveSessionNotice(expiresAt: number): string {
    const date = new Date(expiresAt);
    if (!Number.isFinite(date.getTime()))
        return '';
    return `<p class="live-session-notice">Read-only session ends at <time datetime="${date.toISOString()}">${esc(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }))}</time>. Reloading signs you out. Clearing displayed records keeps this session open.</p>`;
}
