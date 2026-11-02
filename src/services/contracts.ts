/** Verified, intentionally narrow projection of OmniPOS's Hardware product contract.
 * See docs/API_COMPATIBILITY.md. No database client or HTTP adapter is installed. */
export interface HardwareProduct {
  id: string; store_id: string; name: string; sku: string; barcode: string;
  cost_price: number; sell_price: number; stock_qty: number | null;
  uom: string; track_inventory: boolean; is_active: boolean; allow_decimal_qty: boolean;
  category: { id: string; name: string } | null;
}
export interface ProductQuery { search?: string; limit?: number; page?: number }
export interface ProductPage {
  success: true; products: HardwareProduct[]; total: number; page: number;
  limit: number; totalPages: number;
}
export interface HardwareCatalogService {
  getHardwareProducts(storeId: string, params?: ProductQuery, options?: { signal?: AbortSignal }): Promise<ProductPage>;
}
// Prototype-only view state, NOT an OmniPOS invoice-create request.
export interface DraftLine { product: HardwareProduct; qty: number; price: number; discount: number }
export interface InvoiceDraft {
  version: 1; document: string; date: string; customer: string; reference: string;
  payment: string; remarks: string; lines: DraftLine[]; charge: number;
}
