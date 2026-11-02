import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHardwareReadAdapter, type ReadRequest, type ReadAdapterPorts } from '../src/integration/hardwareReadAdapter.ts';
import { HardwareReadError, type ReadIdentity } from '../src/integration/contracts.ts';
import { decodeStartup, resolveHardwareScope } from '../src/integration/decoders.ts';
const userId='11111111-1111-4111-8111-111111111111', organizationId='22222222-2222-4222-8222-222222222222', storeId='33333333-3333-4333-8333-333333333333', otherStore='44444444-4444-4444-8444-444444444444';
const ready:ReadIdentity={userId,organizationId,storeId,revision:1};
const startup=()=>({user:{id:userId,email:'not-projected',access_token:'not-projected'},profile:{id:userId,organization_id:organizationId,role:'OWNER',is_active:true,pin_hash:'not-projected'},organization:{id:organizationId,name:'Contract fixture'},stores:[{id:storeId,organization_id:organizationId,name:'Test store',business_type:'hardware',currency:'KWD'}]});
const productPage=()=>({success:true,products:[{id:'55555555-5555-4555-8555-555555555555',store_id:storeId,name:'Fixture drill',sku:null,barcode:null,cost_price:'1.125',sell_price:2.5,stock_qty:null,uom:'pcs'}],total:1,page:1,limit:50,totalPages:1,coverage:{inventory:'unavailable'},summary:{},correlationId:'req_prod_fixture'});
function harness(overrides:Partial<ReadAdapterPorts>={}) {
 const requests:ReadRequest[]=[];
 const ports:ReadAdapterPorts={enabled:true,getIdentity:()=>ready,getSession:async()=>({userId,accessToken:'contract-test-token'}),transport:async req=>{requests.push(req);return {status:200,body:JSON.stringify(productPage())};},...overrides};
 return {requests,ports,adapter:createHardwareReadAdapter(ports)};
}
const kind=(expected:string)=>(error:unknown)=>error instanceof HardwareReadError&&error.kind===expected;

test('disabled adapter sends zero requests and never reads credentials',async()=>{
 const h=harness({enabled:false,getSession:async()=>{throw Error('Must not access session');}});
 await assert.rejects(h.adapter.getStartupContext(),kind('disabled'));await assert.rejects(h.adapter.getHardwareProducts(storeId),kind('disabled'));assert.equal(h.requests.length,0);
});
test('product GET matches source query and keeps unavailable inventory distinct from zero',async()=>{
 const h=harness(), page=await h.adapter.getHardwareProducts(storeId,{search:'a & b',supplierId:'supplier-filter'});
 assert.equal(h.requests.length,1);const request=h.requests[0],url=new URL(request.url,'https://contract.invalid');
 assert.equal(request.method,'GET');assert.equal(url.pathname,'/api/hardware/products');assert.equal(url.searchParams.get('storeId'),storeId);assert.equal(url.searchParams.get('search'),'a & b');assert.equal(url.searchParams.get('limit'),'50');assert.equal(request.headers.Authorization,'Bearer contract-test-token');assert.equal(Object.hasOwn(request.headers,'x-organization-id'),false);assert.equal(page.products[0].stock_qty,null);assert.equal(page.products[0].cost_price,1.125);
});
test('store mismatch, demo identity and excessive page size fail before transport',async()=>{
 const h=harness();await assert.rejects(h.adapter.getHardwareProducts(otherStore),kind('scope-mismatch'));await assert.rejects(h.adapter.getHardwareProducts(storeId,{limit:101}),kind('not-ready'));assert.equal(h.requests.length,0);
 await assert.rejects(harness({getIdentity:()=>({...ready,userId:'sample-operator'})}).adapter.getStartupContext(),kind('not-ready'));
});
test('missing/mismatched sessions are refused and provider errors are sanitized',async()=>{
 for(const session of [null,{userId:otherStore,accessToken:'contract-test-token'},{userId,accessToken:'bad\r\nvalue'}]){const h=harness({getSession:async()=>session});await assert.rejects(h.adapter.getHardwareProducts(storeId),kind('unauthenticated'));assert.equal(h.requests.length,0);}
 const h=harness({getSession:async()=>{throw Error('provider secret');}});await assert.rejects(h.adapter.getStartupContext(),error=>kind('unauthenticated')(error)&&!(error as Error).message.includes('provider secret'));
});
test('identity changes while resolving credentials prevent any request',async()=>{
 let identity={...ready};const h=harness({getIdentity:()=>identity,getSession:async()=>{identity={...identity,revision:2};return {userId,accessToken:'contract-test-token'};}});
 await assert.rejects(h.adapter.getHardwareProducts(storeId),kind('identity-changed'));assert.equal(h.requests.length,0);
});
test('late response after store/staff/revision changes is discarded, including A to B to A',async()=>{
 for(const next of [{...ready,storeId:otherStore},{...ready,staffId:otherStore},{...ready,revision:3}]){
  let identity={...ready};const h=harness({getIdentity:()=>identity,transport:async()=>{identity=next;return {status:200,body:JSON.stringify(productPage())};}});
  await assert.rejects(h.adapter.getHardwareProducts(storeId),kind('identity-changed'));
 }
});
test('malformed, contradictory, wrong-store and incorrect pagination answers are refused',async()=>{
 for(const body of ['<html>proxy</html>',JSON.stringify({...productPage(),success:false}),JSON.stringify({...productPage(),error:'contradiction'}),JSON.stringify({...productPage(),page:2}),JSON.stringify({...productPage(),products:[{...productPage().products[0],store_id:otherStore}]}),JSON.stringify({...productPage(),products:[{...productPage().products[0],stock_qty:'unknown'}]})]){
  const h=harness({transport:async()=>({status:200,body})});await assert.rejects(h.adapter.getHardwareProducts(storeId),error=>error instanceof HardwareReadError&&['invalid-response','scope-mismatch'].includes(error.kind));
 }
});
test('403 and 503 preserve safe diagnostics without raw backend messages; no retry',async()=>{
 for(const status of [401,403,503]){
  let count=0;const h=harness({transport:async()=>{count++;return {status,body:JSON.stringify({error:'private backend text',code:'SERVICE_UNAVAILABLE',correlationId:'req-safe'})};}});
  await assert.rejects(h.adapter.getHardwareProducts(storeId),error=>error instanceof HardwareReadError&&error.status===status&&error.code==='SERVICE_UNAVAILABLE'&&error.correlationId==='req-safe'&&!error.message.includes('private backend text'));assert.equal(count,1);
 }
});
test('startup projects safe fields and resolves only active matching Hardware stores',async()=>{
 const decoded=decodeStartup(startup(),userId);assert.equal(JSON.stringify(decoded).includes('not-projected'),false);assert.equal(resolveHardwareScope(decoded,storeId,1).organizationId,organizationId);
 assert.throws(()=>resolveHardwareScope({...decoded,profile:{...decoded.profile!,is_active:false}},storeId,1),kind('not-ready'));
 assert.throws(()=>resolveHardwareScope({...decoded,stores:[{...decoded.stores[0],business_type:'grocery'}]},storeId,1),kind('scope-mismatch'));
 assert.throws(()=>decodeStartup({...startup(),stores:[{...startup().stores[0],organization_id:otherStore}]},userId),kind('scope-mismatch'));
 const onboarding=decodeStartup({user:{id:userId},profile:null,organization:null,stores:[]},userId);assert.throws(()=>resolveHardwareScope(onboarding,storeId,1),kind('not-ready'));
 const h=harness({transport:async()=>({status:200,body:JSON.stringify(startup())})});assert.equal((await h.adapter.getStartupContext()).user.id,userId);
});
test('capabilities use separate verified endpoints, with no inferred write methods',async()=>{
 const seen:string[]=[];
 const h=harness({transport:async req=>{seen.push(req.url);return {status:200,body:JSON.stringify(req.url.includes('store-capabilities')?{storeId,currency:'KWD',fractionDigits:3,directTenderV3Enabled:false,splitPrecisionEnabled:false,storeCreditPrecisionEnabled:false}:{success:true,receivingMode:'unavailable',grnReceivingEnabled:true,grnReceivingAvailable:false})};}});
 assert.equal((await h.adapter.getHardwareCapabilities(storeId)).receivingMode,'unavailable');assert.equal((await h.adapter.getHardwareStoreCapabilities(storeId)).fractionDigits,3);assert.equal(seen[0].split('?')[0],'/api/hardware/capabilities');assert.equal(seen[1].split('?')[0],'/api/hardware/store-capabilities');assert.equal('checkout' in h.adapter,false);
});
test('network and aborted reads do not retry or fabricate empty results',async()=>{
 let attempts=0;const h=harness({transport:async()=>{attempts++;throw Error('unavailable');}});await assert.rejects(h.adapter.getHardwareProducts(storeId),kind('network'));assert.equal(attempts,1);
 const controller=new AbortController();controller.abort();await assert.rejects(h.adapter.getHardwareProducts(storeId,{}, {signal:controller.signal}),{name:'AbortError'});assert.equal(attempts,1);
});
test('disabling integration while obtaining a session prevents dispatch',async()=>{
 const h=harness();h.ports.getSession=async()=>{h.ports.enabled=false;return {userId,accessToken:'contract-test-token'};};
 await assert.rejects(h.adapter.getHardwareProducts(storeId),kind('disabled'));assert.equal(h.requests.length,0);
});
test('invalid transport status cannot be treated as successful data',async()=>{
 const h=harness({transport:async()=>({status:0,body:JSON.stringify(productPage())})});
 await assert.rejects(h.adapter.getHardwareProducts(storeId),kind('invalid-response'));
});
