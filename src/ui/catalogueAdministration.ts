import type { DemoBusinessService } from '../services/demoBusinessService';
import { escapeHtml as esc } from './html';
export function catalogueAdministration(name: string, service: DemoBusinessService): string | null {
    if (!['Categories', 'Units of measure', 'Customers', 'Suppliers'].includes(name))
        return null;
    const header = `<div class="page-heading"><div><h1>${esc(name)}</h1><p>Store-scoped sample records. Changes stay in this browser.</p></div><span class="sample-label">Local demo</span></div>`;
    const contact = name === 'Customers' || name === 'Suppliers', kind = contact ? (name === 'Customers' ? 'customers' : 'suppliers') : (name === 'Categories' ? 'categories' : 'units');
    const items = contact ? service.read()[kind as 'customers' | 'suppliers'] : service.getTaxonomies()[kind as 'categories' | 'units'];
    return header + `<p class="panel-description">Historical documents retain their original names. Referenced catalogue entries, contacts with balances and suppliers with open orders cannot be archived.</p><div class="table-scroll"><table class="section-table"><thead><tr><th>Name</th>${contact ? '<th>Contact</th>' : ''}<th>Status</th><th>Action</th></tr></thead><tbody>${items.map(item => {
        const formId = `catalogue-${item.id}`;
        return `<tr><td><form id="${esc(formId)}" data-business-form="${contact ? 'contact-update' : 'taxonomy-update'}" data-kind="${kind}" data-id="${esc(item.id)}"><input name="name" value="${esc(item.name)}" aria-label="Name for ${esc(item.name)}" required maxlength="${contact ? 120 : kind === 'units' ? 24 : 80}"></form></td>${contact ? `<td><input form="${esc(formId)}" name="contact" value="${esc((item as {
            contact: string;
        }).contact)}" aria-label="Contact for ${esc(item.name)}" maxlength="254"></td>` : ''}<td><select form="${esc(formId)}" name="active" aria-label="Status for ${esc(item.name)}"><option value="true" ${item.active !== false ? 'selected' : ''}>Active</option><option value="false" ${item.active === false ? 'selected' : ''}>Archived</option></select></td><td><button form="${esc(formId)}" class="button">Save demo changes</button></td></tr>`;
    }).join('') || `<tr><td colspan="${contact ? 4 : 3}" class="empty-state">No local records yet.</td></tr>`}</tbody></table></div>
 <form class="operation-form" data-business-form="${contact ? 'party' : 'taxonomy-add'}" data-party-kind="${kind}" data-kind="${kind}"><h2>Add ${contact ? 'a contact' : kind === 'units' ? 'a unit' : 'a category'}</h2><div class="settlement-inputs"><label>Name<input name="name" required maxlength="${contact ? 120 : kind === 'units' ? 24 : 80}"></label>${contact ? '<label>Contact<input name="contact" maxlength="254" placeholder="Sample details only"></label>' : ''}</div><button class="button">Add demo record</button></form>`;
}
