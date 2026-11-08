export const recordSaveRoutes = {
    category: '/api/hardware/categories',
    product: '/api/hardware/products',
    supplier: '/api/hardware/suppliers',
} as const;
export type RecordSaveKind = keyof typeof recordSaveRoutes;
export type RecordSaveResult = { status: 'saved'; id: string } | { status: 'conflict' | 'refused' | 'uncertain' };
export type RecordSaveFields = {
    id?: string;
    name: string;
    sku?: string;
    barcode?: string;
    cost?: string;
    price?: string;
    categoryId?: string;
    supplierCode?: string;
};
