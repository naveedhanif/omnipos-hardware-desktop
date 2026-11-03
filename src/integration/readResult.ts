import type { RateDifferencePage } from './rateDifferenceRead.ts';
import type { SupplierReturnPage } from './supplierReturnRead.ts';
import type { SupplierInvoicePage } from './supplierInvoiceRead.ts';
import type { ReceiptPage } from './receiptRead.ts';
import type { ReadProductPage } from './contracts.ts';
import type { InventoryPage } from './inventoryRead.ts';
import type { InvoicePage } from './invoiceRead.ts';
export type ReadResult = {
    kind: 'products';
    data: ReadProductPage;
} | {
    kind: 'inventory';
    data: InventoryPage;
} | {
    kind: 'invoices';
    data: InvoicePage;
} | {
    kind: 'receipts';
    data: ReceiptPage;
} | {
    kind: 'supplierInvoices';
    data: SupplierInvoicePage;
} | {
    kind: 'supplierReturns';
    data: SupplierReturnPage;
} | {
    kind: 'rateDifferences';
    data: RateDifferencePage;
};
