import type { InvoiceDraft } from '../services/contracts';
import { productsForWorkspace } from '../services/sampleHardwareService.ts';
import { createSampleWorkspaceService } from '../services/sampleWorkspaceService.ts';
import type { WorkspaceContext } from './context';

export function createSampleDraft(context: WorkspaceContext): InvoiceDraft {
  const products = productsForWorkspace(context);
  const fixtures = createSampleWorkspaceService(context);
  return {
    version: 1, document: context.storeId === 'sample-hardware-store' ? 'SI-2026-0042' : `SAMPLE-${context.storeId}-001`,
    date: '2026-11-02', customer: fixtures.getCustomers()[0], reference: '', payment: 'Account',
    remarks: 'Sample delivery instructions.', charge: 0,
    lines: [0, 1, 3, 4].map((index, i) => ({ product: products[index], qty: [2, 4, 6, 2][i], price: products[index].sell_price, discount: index === 3 ? 5 : 0 })),
  };
}
