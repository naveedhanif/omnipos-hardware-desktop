import type { DraftLine } from './services/contracts';
export const money=(v:number)=>v.toLocaleString('en-GB',{minimumFractionDigits:3,maximumFractionDigits:3});
export function totals(lines:DraftLine[], charge=0){
 const gross=lines.reduce((n,l)=>n+Math.round(l.qty*l.price*1000),0);
 const discount=lines.reduce((n,l)=>n+Math.round(l.qty*l.price*l.discount/100*1000),0);
 return {gross:gross/1000,discount:discount/1000,net:(gross-discount+Math.round(charge*1000))/1000,qty:lines.reduce((n,l)=>n+l.qty,0)};
}
