import { HardwareReadError, type StartupContext, type HardwareReadScope, type ReadProductPage, type ReceivingCapabilities, type StoreCapabilities } from './contracts.ts';
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export function invalid(): never { throw new HardwareReadError('invalid-response', 'The backend response does not match the reviewed contract.'); }
export function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return invalid();
    return value as Record<string, unknown>;
}
const text = (value: unknown): string => typeof value === 'string' ? value : invalid();
const id = (value: unknown): string => uuid(value) ? value : invalid();
const flag = (value: unknown): boolean => typeof value === 'boolean' ? value : invalid();
const integer = (value: unknown, min: number): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : invalid();
const nullableText = (value: unknown): string | null => value === null ? null : text(value);
function decimal(value: unknown): number | null {
    if (value === null)
        return null;
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)))
        return Number(value);
    return invalid();
}
export function decodeStartup(value: unknown, expectedUserId: string): StartupContext {
    const body = record(value), user = record(body.user);
    if (body.error)
        return invalid();
    if (id(user.id) !== expectedUserId)
        throw new HardwareReadError('scope-mismatch', 'Startup identity does not match the signed-in user.');
    const profile = body.profile === null ? null : record(body.profile);
    const organization = body.organization === null ? null : record(body.organization);
    if (!Array.isArray(body.stores))
        return invalid();
    const result: StartupContext = {
        user: { id: user.id as string },
        profile: profile ? { id: id(profile.id), organization_id: typeof profile.organization_id === 'string' ? profile.organization_id : profile.organization_id === null ? '' : invalid(), role: text(profile.role), is_active: flag(profile.is_active) } : null,
        organization: organization ? { id: id(organization.id), name: text(organization.name) } : null,
        stores: body.stores.map(value => { const store = record(value); return { id: id(store.id), organization_id: id(store.organization_id), name: text(store.name), business_type: text(store.business_type), currency: text(store.currency) }; }),
    };
    if (result.profile && result.profile.id !== expectedUserId)
        throw new HardwareReadError('scope-mismatch', 'Profile identity mismatch.');
    if (result.organization && (!result.profile || result.profile.organization_id !== result.organization.id))
        throw new HardwareReadError('scope-mismatch', 'Organization identity mismatch.');
    if (result.stores.some(store => store.organization_id !== result.organization?.id))
        throw new HardwareReadError('scope-mismatch', 'Startup includes an unrelated store.');
    return result;
}
export function resolveHardwareScope(context: StartupContext, storeId: string, revision: number): HardwareReadScope {
    if (context.profile?.is_active !== true || !context.organization || context.profile.organization_id !== context.organization.id || context.user.id !== context.profile.id)
        throw new HardwareReadError('not-ready', 'An active profile and organization are required.');
    if (!Number.isSafeInteger(revision) || revision < 0)
        return invalid();
    const store = context.stores.find(store => store.id === storeId && store.organization_id === context.organization!.id && store.business_type === 'hardware');
    if (!store)
        throw new HardwareReadError('scope-mismatch', 'Select an authorized Hardware store from startup context.');
    return { userId: context.user.id, organizationId: context.organization.id, storeId, revision };
}
export function decodeProductPage(value: unknown, scope: HardwareReadScope): ReadProductPage {
    const body = record(value);
    if (body.error || body.success !== true || !Array.isArray(body.products))
        return invalid();
    const seen = new Set<string>();
    const products = body.products.map(value => {
        const product = record(value);
        const productId = id(product.id);
        if (seen.has(productId))
            return invalid();
        seen.add(productId);
        if (id(product.store_id) !== scope.storeId)
            throw new HardwareReadError('scope-mismatch', 'Product response includes an unrelated store.');
        return { id: productId, store_id: product.store_id as string, name: text(product.name), sku: nullableText(product.sku), barcode: nullableText(product.barcode), cost_price: decimal(product.cost_price), sell_price: decimal(product.sell_price), stock_qty: decimal(product.stock_qty), uom: nullableText(product.uom) };
    });
    const result: ReadProductPage = { success: true, products, total: integer(body.total, 0), page: integer(body.page, 1), limit: integer(body.limit, 1), totalPages: integer(body.totalPages, 1) };
    if (result.totalPages !== Math.max(1, Math.ceil(result.total / result.limit)) || products.length !== Math.max(0, Math.min(result.total - (result.page - 1) * result.limit, result.limit)))
        return invalid();
    if (body.coverage !== undefined)
        result.coverage = record(body.coverage);
    if (body.summary !== undefined)
        result.summary = record(body.summary);
    if (body.correlationId !== undefined)
        result.correlationId = text(body.correlationId);
    return result;
}
export function decodeReceivingCapabilities(value: unknown): ReceivingCapabilities {
    const body = record(value);
    if (body.error || body.success !== true || !['grn', 'basic', 'unavailable'].includes(String(body.receivingMode)))
        return invalid();
    const result: ReceivingCapabilities = { success: true, receivingMode: body.receivingMode as ReceivingCapabilities['receivingMode'], grnReceivingEnabled: flag(body.grnReceivingEnabled), grnReceivingAvailable: flag(body.grnReceivingAvailable) };
    if (result.grnReceivingAvailable && (!result.grnReceivingEnabled || result.receivingMode !== 'grn'))
        return invalid();
    if (body.correlationId !== undefined)
        result.correlationId = text(body.correlationId);
    return result;
}
export function decodeStoreCapabilities(value: unknown, scope: HardwareReadScope): StoreCapabilities {
    const body = record(value);
    if (body.error)
        return invalid();
    if (id(body.storeId) !== scope.storeId)
        throw new HardwareReadError('scope-mismatch', 'Store capability response scope mismatch.');
    const currency = text(body.currency), fractionDigits = integer(body.fractionDigits, 0);
    if (!/^[A-Z]{3}$/.test(currency) || fractionDigits > 4)
        return invalid();
    return { storeId: body.storeId as string, currency, fractionDigits, directTenderV3Enabled: flag(body.directTenderV3Enabled), splitPrecisionEnabled: flag(body.splitPrecisionEnabled), storeCreditPrecisionEnabled: flag(body.storeCreditPrecisionEnabled) };
}
