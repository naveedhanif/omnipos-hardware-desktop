import { assertDemoContext, workspaceDetails, type WorkspaceContext } from '../workspace/context.ts';
export type DemoRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER';
export interface DemoMember {
    id: string;
    name: string;
    email: string;
    role: DemoRole;
    active: boolean;
}
export interface CompanySettings {
    displayName: string;
    documentPrefix: string;
    country: string;
}
export interface DemoTenantSetupDraft {
    companyName: string;
    contactEmail: string;
    desiredStores: number;
    currency: string;
    requirements: string;
    status: 'draft';
}
export interface DemoAdministration {
    setupDraft?: DemoTenantSetupDraft;
    version: 1;
    organizationId: string;
    members: DemoMember[];
    settings: CompanySettings;
}
export type LocalStoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const roles: DemoRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'];
const clean = (value: string, max = 120) => {
    const text = value.trim();
    if (!text || text.length > max)
        throw new Error(`Enter a value between 1 and ${max} characters.`);
    return text;
};
export function createDemoAdministration(context: WorkspaceContext, storage: LocalStoragePort) {
    assertDemoContext(context);
    const scope = { ...context }, details = workspaceDetails(scope);
    const key = `hardware-demo:administration:v1:${scope.organizationId}`;
    function initial(): DemoAdministration {
        return { version: 1, organizationId: scope.organizationId,
            members: [{ id: 'demo-owner', name: 'Sample company owner', email: 'owner@example.invalid', role: 'OWNER', active: true }],
            settings: { displayName: details.organization.name, documentPrefix: 'HW', country: 'Not configured' } };
    }
    function read(): DemoAdministration {
        const raw = storage.getItem(key);
        if (!raw)
            return initial();
        const value = JSON.parse(raw) as DemoAdministration;
        if (value.version !== 1 || value.organizationId !== scope.organizationId || !Array.isArray(value.members) || !value.settings ||
            value.members.some(m => typeof m.id !== 'string' || !/^[-\w]{1,80}$/.test(m.id) || typeof m.name !== 'string' || typeof m.email !== 'string' || typeof m.active !== 'boolean' || !roles.includes(m.role)) ||
            !value.members.some(m => m.role === 'OWNER' && m.active) || ['displayName', 'documentPrefix', 'country'].some(key => typeof (value.settings as unknown as Record<string, unknown>)[key] !== 'string'))
            throw new Error('Local company data is invalid. No changes were made.');
        if (value.setupDraft && (value.setupDraft.status !== 'draft' || typeof value.setupDraft.companyName !== 'string' || typeof value.setupDraft.contactEmail !== 'string' || !Number.isInteger(value.setupDraft.desiredStores) || value.setupDraft.desiredStores < 1 || value.setupDraft.desiredStores > 100 || typeof value.setupDraft.currency !== 'string' || !/^[A-Z]{3}$/.test(value.setupDraft.currency) || typeof value.setupDraft.requirements !== 'string' || value.setupDraft.requirements.length > 2000))
            throw new Error('Invalid local tenant setup draft.');
        return value;
    }
    function commit(value: DemoAdministration) { storage.setItem(key, JSON.stringify(value)); }
    function requireAdmin() {
        if (!['Owner', 'Admin'].includes(details.organization.role))
            throw new Error('This demo action requires the company owner or administrator.');
    }
    return {
        read, canManage: () => ['Owner', 'Admin'].includes(details.organization.role),
        addMember(input: {
            name: string;
            email: string;
            role: DemoRole;
        }) {
            requireAdmin();
            const value = read();
            if (!roles.includes(input.role))
                throw new Error('Choose a supported role.');
            const name = clean(input.name), email = clean(input.email, 254).toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                throw new Error('Enter a valid sample email address.');
            if (value.members.some(m => m.email.toLowerCase() === email))
                throw new Error('That email already exists in this demo company.');
            value.members.push({ id: crypto.randomUUID(), name, email, role: input.role, active: true });
            commit(value);
        },
        updateMember(id: string, patch: {
            role: DemoRole;
            active: boolean;
        }) {
            requireAdmin();
            const value = read(), member = value.members.find(m => m.id === id);
            if (!member || !roles.includes(patch.role) || typeof patch.active !== 'boolean')
                throw new Error('Invalid company member.');
            Object.assign(member, patch);
            if (!value.members.some(m => m.active && m.role === 'OWNER'))
                throw new Error('Keep at least one active company owner.');
            commit(value);
        },
        saveSetupDraft(input: Omit<DemoTenantSetupDraft, 'status'>) { requireAdmin(); const value = read(), contactEmail = clean(input.contactEmail, 254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || !Number.isInteger(input.desiredStores) || input.desiredStores < 1 || input.desiredStores > 100 || !/^[A-Z]{3}$/.test(input.currency) || input.requirements.length > 2000)
            throw new Error('Enter a valid sample email, store count, currency code and requirements.'); value.setupDraft = { companyName: clean(input.companyName), contactEmail, desiredStores: input.desiredStores, currency: input.currency, requirements: input.requirements.trim(), status: 'draft' }; commit(value); },
        saveSettings(input: CompanySettings) { requireAdmin(); const value = read(); value.settings = { displayName: clean(input.displayName), documentPrefix: clean(input.documentPrefix, 12), country: clean(input.country, 80) }; commit(value); },
    };
}
