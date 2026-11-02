/** Read-only projections verified against OmniPOS source. No Supabase client or live transport. */
export interface BackendProfile { id: string; organization_id: string; role: string; is_active: boolean }
export interface BackendStore { id: string; organization_id: string; name: string; business_type: string; currency: string }
export interface StartupContext {
  user: { id: string };
  profile: BackendProfile | null;
  organization: { id: string; name: string } | null;
  stores: BackendStore[];
}
// revision is a client-side invalidation generation, NOT an API/auth field.
export interface ReadIdentity { userId: string; organizationId?: string; storeId?: string; staffId?: string; revision: number }
export interface HardwareReadScope extends ReadIdentity { organizationId: string; storeId: string }
export interface ProductReadQuery {
  search?: string; limit?: number; page?: number; categoryId?: string; supplierId?: string;
  stockStatus?: string; priceStatus?: string; costStatus?: string; skuStatus?: string; activeStatus?: string;
}
export interface ReadProduct {
  id: string; store_id: string; name: string; sku: string | null; barcode: string | null;
  cost_price: number | null; sell_price: number | null; stock_qty: number | null; uom: string | null;
}
export interface ReadProductPage {
  success: true; products: ReadProduct[]; total: number; page: number; limit: number; totalPages: number;
  coverage?: Record<string, unknown>; summary?: Record<string, unknown>; correlationId?: string;
}
export interface ReceivingCapabilities {
  success: true; receivingMode: 'grn' | 'basic' | 'unavailable'; grnReceivingEnabled: boolean; grnReceivingAvailable: boolean; correlationId?: string;
}
export interface StoreCapabilities {
  storeId: string; currency: string; fractionDigits: number; directTenderV3Enabled: boolean;
  splitPrecisionEnabled: boolean; storeCreditPrecisionEnabled: boolean;
}
export type ReadErrorKind = 'disabled' | 'unauthenticated' | 'not-ready' | 'forbidden' | 'scope-mismatch' | 'identity-changed' | 'invalid-response' | 'http' | 'network';
export class HardwareReadError extends Error {
  readonly kind: ReadErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly correlationId?: string;
  constructor(kind: ReadErrorKind, message: string, status?: number, code?: string, correlationId?: string) {
    super(message); this.name = 'HardwareReadError'; this.kind = kind;
    this.status = status; this.code = code; this.correlationId = correlationId;
  }
}
