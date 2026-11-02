import type { HardwareCatalogService, HardwareProduct, InvoiceDraft } from './contracts';
export const SAMPLE_STORE_ID = 'sample-hardware-store';
const entries = [
 ['HW-1001','Cordless drill driver 18V','Power tools',24.5,32.75,18,'pcs'],
 ['HW-1002','Claw hammer 16 oz','Hand tools',2.85,4.25,64,'pcs'],
 ['HW-1003','PVC elbow 90° · 25 mm','Plumbing',0.12,0.25,240,'pcs'],
 ['HW-1004','Multi-purpose screw 4 × 40 mm','Fasteners',0.85,1.5,85,'box'],
 ['HW-1005','Measuring tape 5 m','Hand tools',1.65,2.75,42,'pcs'],
 ['HW-1006','Electrical cable 2.5 mm²','Electrical',0.18,0.35,150,'m'],
 ['HW-1007','Adjustable wrench 10 in','Hand tools',3.2,5.5,0,'pcs'],
 ['HW-1008','Safety gloves, size L','Safety',0.65,1.25,120,'pair'],
] as const;
export const sampleProducts: HardwareProduct[] = entries.map((e,i)=>({id:`sample-product-${i+1}`,store_id:SAMPLE_STORE_ID,sku:e[0],name:e[1],category:{id:`sample-category-${e[2]}`,name:e[2]},cost_price:e[3],sell_price:e[4],stock_qty:e[5],uom:e[6],barcode:`62910000000${i+1}`,track_inventory:true,is_active:true,allow_decimal_qty:e[6]==='m'}));
export const hardwareService: HardwareCatalogService = {
 async getHardwareProducts(storeId, params = {}, options) {
  options?.signal?.throwIfAborted();
  if(storeId!==SAMPLE_STORE_ID) throw new Error('This prototype accepts only the sample store.');
  const search=(params.search??'').trim().toLowerCase();
  const rows=sampleProducts.filter(p=>[p.name,p.sku,p.barcode].some(v=>v.toLowerCase().includes(search))).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const page=Math.max(1,params.page??1), limit=Math.max(1,params.limit??50);
  return structuredClone({success:true as const,products:rows.slice((page-1)*limit,page*limit),total:rows.length,page,limit,totalPages:Math.ceil(rows.length/limit)||1});
 }
};
const key='omnipos-hardware-prototype:draft:v1';
export const draftService={
 save(draft:InvoiceDraft){localStorage.setItem(key,JSON.stringify(draft));},
 load():InvoiceDraft|null{const raw=localStorage.getItem(key);if(!raw)return null;const d=JSON.parse(raw);if(d.version!==1||!Array.isArray(d.lines)||typeof d.document!=='string')throw new Error('Saved sample draft could not be read.');return d;}
};
