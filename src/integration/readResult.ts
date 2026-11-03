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
};
