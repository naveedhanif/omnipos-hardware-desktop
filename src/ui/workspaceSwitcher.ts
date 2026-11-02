import { demoOrganizations, workspaceDetails, type WorkspaceContext } from '../workspace/context';
import { escapeHtml as esc } from './html';
export function workspaceSwitcher(context: WorkspaceContext): string {
  const { organization } = workspaceDetails(context);
  return `<div class="workspace-switcher" aria-label="Sample workspace selection">
    <label><span>Company</span><select id="organization-switch" aria-label="Company">${demoOrganizations.map(o => `<option value="${o.id}" ${o.id === context.organizationId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>
    <label><span>Store</span><select id="store-switch" aria-label="Store">${organization.stores.map(s => `<option value="${s.id}" ${s.id === context.storeId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    <span class="sample-label" title="Demo membership only; no authentication or server authorization">Demo / ${organization.role}</span></div>`;
}
