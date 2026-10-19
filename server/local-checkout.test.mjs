import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { checkoutDb, stripePrice } from './testing/checkout-db.mjs';
import { checkout } from './checkout/checkout-session.ts';
import assert from 'node:assert/strict';
import { localSettings, prepareLocalCatalogue } from '../scripts/local-checkout.mjs';

const ids = ['orange-spritz','passion-hugo','ginger-crush','pack-variat'];
const env = { STRIPE_SECRET_KEY: 'sk_test_fixture', SITE_URL: 'http://localhost:4200',
  STRIPE_PRICE_ORANGE_SPRITZ: 'price_orange', STRIPE_PRICE_PASSION_HUGO: 'price_passion',
  STRIPE_PRICE_GINGER_CRUSH: 'price_ginger', STRIPE_PRICE_PACK_VARIAT: 'price_pack' };
const prices = ['price_orange','price_passion','price_ginger','price_pack'];
function fixture() {
  const rows = ids.map((id,index) => ({ id, status:'active', price_cents:3600, currency:'eur', stripe_price_id:prices[index] }));
  const writes=[];
  const query=async sql => { if(sql.startsWith('SELECT')) return rows; writes.push(sql); return []; };
  const stripe={ prices:{ async retrieve(id) { return { id,product:'prod_fixture',livemode:false,active:true,
    type:'one_time',billing_scheme:'per_unit',currency:'eur',unit_amount:3600 }; } } };
  return {rows,writes,query,stripe};
}

test('local tooling refuses live keys and non-local return origins', () => {
  for (const key of ['sk_live_fixture','rk_live_fixture','',undefined]) {
    assert.throws(()=>localSettings({...env,STRIPE_SECRET_KEY:key}),/^Error: test_key_required$/);
  }
  for (const url of ['https://naisdrinks.com','http://example.com:4200','http://localhost:8788','http://localhost:4200/checkout','http://user:pass@localhost:4200']) {
    assert.throws(()=>localSettings({...env,SITE_URL:url}),/^Error: local_origin_required$/);
  }
  assert.equal(localSettings(env).origin,'http://localhost:4200');
  assert.equal(localSettings(env).webhookReady,false);
  assert.equal(localSettings({...env,STRIPE_WEBHOOK_SECRET:'whsec_fixture'}).webhookReady,true);
});

test('read-only check validates all TEST prices against D1 without changing anything', async () => {
  const f=fixture(); assert.deepEqual(await prepareLocalCatalogue(env,f.query,f.stripe),
    {productsChecked:4,mappingsToUpdate:0,applied:false}); assert.deepEqual(f.writes,[]);
});

test('local sync changes only missing price mappings, in one statement, and is repeatable', async () => {
  const f=fixture(); f.rows[0].stripe_price_id=null;
  assert.equal((await prepareLocalCatalogue(env,f.query,f.stripe,true)).mappingsToUpdate,1);
  assert.equal(f.writes.length,1);
  assert.match(f.writes[0],/^UPDATE products SET stripe_price_id=CASE/);
  assert.doesNotMatch(f.writes[0],/stripe_product_id|price_cents=|status=|orders/);
  f.rows[0].stripe_price_id=prices[0]; await prepareLocalCatalogue(env,f.query,f.stripe,true);
  assert.equal(f.writes.length,1);
});

for(const patch of [{livemode:true},{unit_amount:3750},{currency:'usd'},{active:false},{type:'recurring'},{billing_scheme:'tiered'}]) {
  test(`invalid TEST price prevents every local write: ${JSON.stringify(patch)}`,async()=>{
    const f=fixture(); f.rows[0].stripe_price_id=null;
    const retrieve=f.stripe.prices.retrieve;
    f.stripe.prices.retrieve=async id=>({...await retrieve(id),...(id===prices[3]?patch:{})});
    await assert.rejects(prepareLocalCatalogue(env,f.query,f.stripe,true),/^Error: test_price_mismatch$/);
    assert.deepEqual(f.writes,[]);
  });
}

test('provider errors are normalized without secrets or response content', async()=>{
  const f=fixture(); f.stripe.prices.retrieve=async()=>{throw Error('private provider response and credential');};
  await assert.rejects(prepareLocalCatalogue(env,f.query,f.stripe,true),/^Error: stripe_test_price_lookup_failed$/);
  assert.deepEqual(f.writes,[]);
});

for(const status of ['sold-out','coming-soon','draft','archived']) {
  test(`local setup never activates or changes an unavailable product: ${status}`,async()=>{
    const f=fixture(); f.rows[0].status=status;
    await assert.rejects(prepareLocalCatalogue(env,f.query,f.stripe,true),/^Error: local_catalogue_invalid$/);
    assert.deepEqual(f.writes,[]);
  });
}

for (const [quantity, shipping, total] of [[1,600,4200],[2,0,7200]]) {
  test(`local TEST Session preserves return URLs and total for ${quantity} boxes`, async t => {
    const {db}=checkoutDb(t); const sessions=[];
    const client=()=>({ prices:{async retrieve(id){return stripePrice(id);}}, checkout:{sessions:{async create(params){sessions.push(params);return {url:'https://checkout.stripe.com/c/pay/cs_test_fixture'};}}}});
    const request=new Request('http://localhost:4200/api/checkout',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:4200'},body:JSON.stringify({items:[{productId:'orange-spritz',quantity}],locale:'ca'})});
    const response=await checkout(request,{PROMO_DB:db,STRIPE_SECRET_KEY:env.STRIPE_SECRET_KEY,SITE_URL:env.SITE_URL},client);
    assert.equal(response.status,200); assert.equal(sessions.length,1);
    assert.equal(sessions[0].success_url,'http://localhost:4200/checkout/success?session_id={CHECKOUT_SESSION_ID}');
    assert.equal(sessions[0].cancel_url,'http://localhost:4200/checkout/cancel');
    assert.equal(sessions[0].shipping_options[0].shipping_rate_data.fixed_amount.amount,shipping);
    assert.equal(3600*quantity+shipping,total);
    assert.equal(sessions[0].allow_promotion_codes,true);
  });
}

test('latest migrated sold-out Harvest is rejected before Stripe while malformed input stays rejected',async t=>{
  const {db,sqlite}=checkoutDb(t);
  sqlite.exec(readFileSync(new URL('../migrations/0011_harvest_sold_out.sql',import.meta.url),'utf8'));
  assert.equal(sqlite.prepare("SELECT status FROM products WHERE id='tropical-hops-harvest'").get().status,'sold-out');
  for(const body of [{items:[{productId:'tropical-hops-harvest',quantity:1}]},{items:[]},{items:[{productId:'orange-spritz',quantity:1,price:1}]}]) {
    const request=new Request('http://localhost:4200/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await checkout(request,{PROMO_DB:db,STRIPE_SECRET_KEY:env.STRIPE_SECRET_KEY,SITE_URL:env.SITE_URL},()=>{throw Error('Stripe must not be initialized');});
    assert.equal(response.status,400);
  }
});
