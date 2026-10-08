import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { checkoutDb, stripePrice } from './testing/checkout-db.mjs';
import { requireAdmin } from './admin/admin-auth.ts';
import { adminProductWrite } from './admin/admin-product-write.ts';
import { onRequest as createRoute } from '../functions/api/admin/products/index.ts';
import { onRequest as updateRoute } from '../functions/api/admin/products/[id].ts';
import { onRequest as archiveRoute } from '../functions/api/admin/products/[id]/archive.ts';
import { listActiveProducts, getPurchasableProducts } from './catalogue/product.service.ts';
import { readFileSync } from 'node:fs';

const env = { ACCESS_TEAM_DOMAIN: 'https://test.cloudflareaccess.com', ACCESS_AUD: 'fixture',
  ADMIN_EMAILS: 'admin@example.test', STRIPE_SECRET_KEY: 'sk_test_fixture' };
const { privateKey, publicKey } = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] });
async function token(email='admin@example.test') {
  return new SignJWT({ email, type:'app' }).setProtectedHeader({ alg:'RS256', kid:'test' })
    .setSubject('fixture').setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(env.ACCESS_AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
}
const valid = { slug:' New-Drink ', name:' New Drink ', priceCents:3600 };
async function setup(t) {
  const {db, sqlite} = checkoutDb(t);
  const jwt = await token();
  let priceCalls = 0;
  let getPrice = async id => stripePrice(id);
  async function send(action, payload, id='orange-spritz', options={}) {
    const method = action==='update'?'PATCH':'POST';
    const context = { request:new Request('https://nais.example/api/admin/products', { method,
      headers:{ 'Content-Type':options.contentType ?? 'application/json', Origin:options.origin ?? 'https://nais.example',
        ...(options.jwt===null?{}:{'Cf-Access-Jwt-Assertion':options.jwt ?? jwt}) },
      body:options.raw ?? (payload===undefined?undefined:JSON.stringify(payload)) }),
      env:{...env,PROMO_DB:db}, data:{}, params:{id},
      next:()=> options.adapter ? options.adapter(context) : adminProductWrite(context,action,()=>({prices:{retrieve:async id=>{priceCalls++;return getPrice(id);}}})) };
    return requireAdmin(context,()=>keys);
  }
  return { db,sqlite,send,calls:()=>priceCalls,setPrice:fn=>{getPrice=fn;} };
}
test('create draft normalizes slug/name, generates stable ID and keeps Stripe columns null',async t=>{
  const {send,sqlite}=await setup(t);
  const response=await send('create',valid,undefined,{adapter:createRoute});
  assert.equal(response.status,201); const p=await response.json();
  assert.equal(p.slug,'new-drink');assert.equal(p.name,'New Drink');assert.equal(p.status,'draft');
  assert.equal(p.currency,'eur');assert.equal(p.stripePriceId,null);assert.equal(p.stripeProductId,null);
  assert.match(p.id,/^[a-f0-9-]{36}$/);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM products WHERE id=?').get(p.id).n,1);
});
test('duplicate slug including simultaneous normalized creates yields one success and 409',async t=>{
  const {send}=await setup(t);
  const responses=await Promise.all([send('create',valid),send('create',valid)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  assert.equal((await send('create',{...valid,slug:' ORANGE-SPRITZ '})).status,409);
});
test('rejects invalid payload/status/price/currency and all server-controlled fields',async t=>{
  const {send}=await setup(t);
  for(const payload of [null,[],{}, {...valid,status:'bad'},{...valid,status:['active']},
    {...valid,name:' '},{...valid,slug:'../bad'}, ...[-1,1.5,Number.MAX_SAFE_INTEGER+1].map(priceCents=>({...valid,priceCents})),
    {...valid,currency:'usd'},{...valid,stripePriceId:'price_attack'},{...valid,stripeProductId:'prod_attack'},
    {...valid,id:'client'},{...valid,imageUrl:'javascript:alert(1)'},{...valid,imageUrl:'//evil.test/x'},
    {...valid,status:'active'}]) assert.equal((await send('create',payload)).status,400);
  for(const raw of ['{', '{"slug":"x","name":"X","priceCents":1e999}', ' '.repeat(32769)]) assert.equal((await send('create',{},undefined,{raw})).status,400);
  assert.equal((await send('create',valid,undefined,{contentType:'text/plain'})).status,400);
});
test('PATCH updates existing active product only with matching read-only Stripe Price',async t=>{
  const {send,sqlite,calls}=await setup(t);
  const response=await send('update',{name:'Edited',slug:' Edited-Slug ',description:' Text '});
  assert.equal(response.status,200);const p=await response.json();
  assert.equal(p.id,'orange-spritz');assert.equal(p.slug,'edited-slug');assert.equal(p.description,'Text');
  assert.equal(p.stripePriceId,'price_orangeFixture');assert.equal(calls(),1);
  assert.equal(sqlite.prepare('SELECT name FROM products WHERE id=?').get('orange-spritz').name,'Edited');
});
test('rejects active price mismatch, zero price, absent Stripe mapping and Stripe errors without writing',async t=>{
  const {send,sqlite,setPrice}=await setup(t);
  assert.equal((await send('update',{priceCents:4000})).status,400);
  assert.equal((await send('update',{priceCents:0})).status,400);
  assert.equal((await send('update',{status:'active'},'tropical-hops-harvest')).status,400);
  setPrice(async()=>{throw Error('private stripe');});
  const failure=await send('update',{name:'Must not persist'});assert.equal(failure.status,503);
  assert.deepEqual(await failure.json(),{status:'unavailable'});
  assert.equal(sqlite.prepare('SELECT price_cents FROM products WHERE id=?').get('orange-spritz').price_cents,3600);
});
test('draft edit and activation reuse server mapping; public visibility and eligibility follow status',async t=>{
  const {send,db}=await setup(t);
  assert.equal((await send('update',{status:'draft' },'orange-spritz',{adapter:updateRoute})).status,200);
  assert.ok(!(await listActiveProducts(db)).some(p=>p.id==='orange-spritz'));
  await assert.rejects(getPurchasableProducts(db,['orange-spritz']));
  assert.equal((await send('update',{status:'active'})).status,200);
  assert.ok((await listActiveProducts(db)).some(p=>p.id==='orange-spritz'));
  for(const status of ['draft','coming-soon','archived']) {
    assert.equal((await send('update',{status})).status,200);
    await assert.rejects(getPurchasableProducts(db,['orange-spritz']));
  }
});
test('unknown IDs return 404 and slug conflict on PATCH returns 409',async t=>{
  const {send}=await setup(t);
  assert.equal((await send('update',{name:'Unknown'},'unknown')).status,404);
  assert.equal((await send('archive',undefined,'unknown')).status,404);
  assert.equal((await send('update',{slug:'ginger-crush'})).status,409);
  assert.equal((await send('update',{stripePriceId:'price_attack'})).status,400);
});
test('archive is non-destructive, preserves order rows and is idempotent',async t=>{
  const {send,sqlite,db}=await setup(t);
  sqlite.exec(readFileSync(new URL('../migrations/0003_orders.sql',import.meta.url),'utf8'));
  sqlite.exec(`INSERT INTO orders(id,order_number,stripe_checkout_session_id,stripe_event_id,stripe_payment_intent_id,
    customer_name,customer_email,shipping_name,shipping_address_line1,shipping_postal_code,shipping_city,shipping_country,
    subtotal_amount,shipping_amount,discount_amount,tax_amount,total_amount,currency,payment_status,paid_at)
    VALUES('fixture','NAIS-fixture','cs_fixture','evt_fixture','pi_fixture','Synthetic','buyer@example.test','Synthetic','Test','00000','Test','ES',3600,600,0,0,4200,'eur','paid','2026-01-01T00:00:00.000Z');
    INSERT INTO order_items VALUES('item','fixture','li_fixture','orange-spritz','Historical','price_fixture',1,3600,3600);`);
  const before=sqlite.prepare('SELECT * FROM order_items').all();
  for(let i=0;i<2;i++) assert.equal((await send('archive',undefined,'orange-spritz',{adapter:archiveRoute})).status,200);
  assert.equal(sqlite.prepare('SELECT status FROM products WHERE id=?').get('orange-spritz').status,'archived');
  assert.deepEqual(sqlite.prepare('SELECT * FROM order_items').all(),before);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM orders').get().n,1);
  await assert.rejects(getPurchasableProducts(db,['orange-spritz']));
});
test('all mutations deny missing/unauthorized JWT and cross-origin requests',async t=>{
  const {send,sqlite}=await setup(t);
  for(const action of ['create','update','archive']) {
    assert.equal((await send(action,valid,undefined,{jwt:null})).status,401);
    assert.equal((await send(action,valid,undefined,{jwt:await token('other@example.test')})).status,403);
    assert.equal((await send(action,valid,undefined,{origin:'https://evil.test'})).status,403);
  }
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM products').get().n,6);
});
test('concurrent edit detected after Stripe lookup does not overwrite archived state',async t=>{
  const {send,sqlite,setPrice}=await setup(t);
  setPrice(async id=>{sqlite.prepare("UPDATE products SET status='archived' WHERE id=?").run('orange-spritz');return stripePrice(id);});
  assert.equal((await send('update',{name:'Stale'})).status,409);
  assert.equal(sqlite.prepare('SELECT status FROM products WHERE id=?').get('orange-spritz').status,'archived');
});
