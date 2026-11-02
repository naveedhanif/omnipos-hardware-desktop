import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hardwareService,SAMPLE_STORE_ID,sampleProducts} from '../src/services/sampleHardwareService.ts';
import {totals} from '../src/money.ts';
test('catalogue respects search, pagination, scope, cancellation and fixture isolation',async()=>{
 const r=await hardwareService.getHardwareProducts(SAMPLE_STORE_ID,{search:'HW-1001'});
 assert.equal(r.total,1);assert.equal(r.products[0].sell_price,32.75);
 const b=await hardwareService.getHardwareProducts(SAMPLE_STORE_ID,{search:'629100000001'});assert.equal(b.products[0].id,r.products[0].id);
 const p=await hardwareService.getHardwareProducts(SAMPLE_STORE_ID,{limit:3,page:2});assert.equal(p.products.length,3);assert.equal(p.total,8);assert.equal(p.totalPages,3);
 r.products[0].name='changed';assert.notEqual((await hardwareService.getHardwareProducts(SAMPLE_STORE_ID,{search:'HW-1001'})).products[0].name,'changed');
 await assert.rejects(hardwareService.getHardwareProducts('real-store'));
 const c=new AbortController();c.abort();await assert.rejects(hardwareService.getHardwareProducts(SAMPLE_STORE_ID,{}, {signal:c.signal}));
});
test('sample totals use line rounding at KWD precision with percentage discount and charges',()=>{
 const t=totals([{product:sampleProducts[3],qty:6,price:1.5,discount:5}],1.125);
 assert.equal(t.gross,9);assert.equal(t.discount,.45);assert.equal(t.net,9.675);assert.equal(t.qty,6);
 assert.equal(totals([]).net,0);
});
