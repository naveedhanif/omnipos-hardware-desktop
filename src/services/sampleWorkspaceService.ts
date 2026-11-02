/** Local presentation fixtures only. These are NOT additional Hardware API contracts. */
export interface SampleRegister {
  description: string;
  columns: string[];
  rows: string[][];
}
const registers: Record<string, SampleRegister> = {
  'Customers': {
    description: 'Illustrative customer directory.',
    columns: ['Customer code', 'Customer name', 'Phone', 'Email', 'Account status'],
    rows: [['SAMPLE-C001', 'Al Noor Building Maintenance', 'Not provided', 'Not provided', 'Sample account'], ['SAMPLE-C002', 'Gulf Workshop Supplies', 'Not provided', 'Not provided', 'Sample account']],
  },
  'Bills payable': {
    description: 'Illustrative supplier bills. No payable is linked to this invoice.',
    columns: ['Bill reference', 'Supplier', 'Bill date', 'Due date', 'Currency', 'Outstanding', 'Allocated'],
    rows: [['SAMPLE-PB-014', 'Gulf Industrial Supplies', '20 Oct 2026', '19 Nov 2026', 'KWD', '245.000', '0.000'], ['SAMPLE-PB-019', 'Coastal Tools Trading', '28 Oct 2026', '27 Nov 2026', 'KWD', '86.500', '0.000']],
  },
  'Bills receivable': {
    description: 'Illustrative customer bills. These balances do not affect the sample invoice.',
    columns: ['Invoice reference', 'Customer', 'Invoice date', 'Due date', 'Currency', 'Outstanding', 'Allocated'],
    rows: [['SAMPLE-SI-028', 'Al Noor Building Maintenance', '18 Oct 2026', '17 Nov 2026', 'KWD', '125.750', '0.000']],
  },
  'Cash': {
    description: 'Cash settlement layout for review. No money has been received or posted.',
    columns: ['Cash account', 'Currency', 'Tendered', 'Applied', 'Change', 'Status'],
    rows: [['Main store cash', 'KWD', '0.000', '0.000', '0.000', 'Not received']],
  },
  'Cheques': {
    description: 'Cheque register layout. Cheque collection and bank posting are deferred.',
    columns: ['Cheque no.', 'Bank', 'Cheque date', 'Account name', 'Amount', 'Status'],
    rows: [],
  },
  'Post dated cheques': {
    description: 'Post-dated cheque schedule layout. No cheque has been issued or received.',
    columns: ['Cheque no.', 'Bank', 'Issue date', 'Maturity date', 'Amount', 'Direction', 'Status'],
    rows: [],
  },
  'Cheques [PDC]': {
    description: 'PDC allocation layout. The distinction from the preceding cheque view needs workflow review.',
    columns: ['PDC reference', 'Cheque no.', 'Maturity date', 'Amount', 'Allocated', 'Balance', 'Status'],
    rows: [],
  },
  'Allocations': {
    description: 'Document allocation layout. No payment, credit, or invoice has been linked.',
    columns: ['Document type', 'Reference', 'Date', 'Currency', 'Outstanding', 'Allocated', 'Remaining'],
    rows: [],
  },
};
export const sampleWorkspaceService = {
  getRegister(name: string): SampleRegister {
    return structuredClone(registers[name] ?? {
      description: 'Frontend layout only. Data and workflow integration are deferred.',
      columns: ['Reference', 'Date', 'Description', 'Status'], rows: [],
    });
  },
  getItemPresentation(productId: string) {
    // Supplemental sample UI metadata, deliberately separate from HardwareProduct.
    const hasBatch = ['sample-product-4', 'sample-product-6'].includes(productId);
    return { hasBatch, batch: hasBatch ? 'SAMPLE-B-026' : null, landedRate: null };
  },
  getItemHistory(productId: string) {
    return [
      { reference: `SAMPLE-OPEN-${productId.split('-').at(-1)}`, date: '01 Nov 2026', type: 'Opening stock', note: 'Illustrative opening entry; current sample availability is unchanged.' },
    ];
  },
};
