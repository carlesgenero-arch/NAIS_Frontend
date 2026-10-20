import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createPaidOrder, getPublicOrder } from './orders/order.service.ts';
import { getAdminOrder, listAdminOrders } from './orders/admin-order.service.ts';
import { readConfirmation } from './orders/order-confirmation.repository.ts';
import { confirmationMessage } from './orders/order-confirmation.template.ts';
import { notificationMessage } from './orders/order-notification.template.ts';
import { readNotification } from './orders/order-notification.repository.ts';
import { shippingMessage } from './orders/shipping-email.template.ts';

const migration = name => readFileSync(new URL('../migrations/'+name, import.meta.url), 'utf8');
const snapshot = (index, paid_at='2026-10-20T10:00:00.000Z') => ({
  stripe_checkout_session_id: 'cs_test_' + String(index).padStart(24,'0'), stripe_event_id:'evt_'+index,
  stripe_payment_intent_id:'pi_'+index, stripe_customer_id:null, customer_name:'Synthetic',
  customer_email:'synthetic@example.test', customer_phone:null, shipping_name:'Synthetic',
  shipping_address_line1:'Example 1', shipping_address_line2:null, shipping_postal_code:'00000',
  shipping_city:'Example', shipping_country:'ES', subtotal_amount:3600, shipping_amount:600,
  discount_amount:0, tax_amount:0, total_amount:4200, currency:'eur', paid_at,
  items:[{stripe_line_item_id:'li_'+index,product_id:'synthetic',product_name:'Historical item',
    stripe_price_id:'price_'+index,quantity:1,unit_amount:3600,line_total_amount:3600}],
});
function adapter(sqlite) {
  return {prepare(sql){return {sql,values:[],bind(...values){this.values=values;return this;},
    async first(){return sqlite.prepare(sql).get(...this.values)??null;},
    async all(){return {success:true,results:sqlite.prepare(sql).all(...this.values)};}};},
    async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>{
      sqlite.prepare(s.sql).run(...s.values);return {success:true};});sqlite.exec('COMMIT');return result;
    }catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
function setup(t, migrate=true) {
  const sqlite = new DatabaseSync(':memory:');t.after(()=>sqlite.close());
  sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(migration('0003_orders.sql'));sqlite.exec(migration('0015_order_archiving.sql'));
  if(migrate) sqlite.exec(migration('0014_order_reference.sql'));
  return {sqlite,db:adapter(sqlite)};
}
test('first, sequential and yearly references are stable; duplicate sessions never consume a number', async t=>{
  const {sqlite,db}=setup(t);
  await createPaidOrder(db,snapshot(1));await createPaidOrder(db,snapshot(1));
  await createPaidOrder(db,snapshot(2));
  await createPaidOrder(db,snapshot(3,'2027-01-01T00:00:00.000Z'));
  await createPaidOrder(db,snapshot(4,'2026-12-31T23:59:59.000Z'));
  assert.deepEqual(sqlite.prepare('SELECT order_reference FROM orders ORDER BY stripe_event_id').all().map(r=>r.order_reference),
    ['NAIS-2026-0001','NAIS-2026-0002','NAIS-2027-0001','NAIS-2026-0003']);
  const first=sqlite.prepare("SELECT * FROM orders WHERE stripe_event_id='evt_1'").get();
  assert.equal(first.order_number, 'NAIS-'+first.id.toUpperCase());
  assert.equal(first.stripe_checkout_session_id,snapshot(1).stripe_checkout_session_id);
  assert.throws(()=>sqlite.prepare('UPDATE orders SET order_reference=? WHERE stripe_event_id=?')
    .run(first.order_reference,'evt_2'));
});
test('failed item persistence rolls reference/counter back with the order',async t=>{
  const {sqlite,db}=setup(t);
  sqlite.exec("CREATE TRIGGER fail_item BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  await assert.rejects(createPaidOrder(db,snapshot(1)));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM order_reference_counters').get().n,0);
  sqlite.exec('DROP TRIGGER fail_item');await createPaidOrder(db,snapshot(2));
  assert.equal(sqlite.prepare('SELECT order_reference r FROM orders').get().r,'NAIS-2026-0001');
});
test('sequence grows beyond four digits without truncation',async t=>{
  const {sqlite,db}=setup(t);
  sqlite.exec('INSERT INTO order_reference_counters VALUES(2026,9999)');
  await createPaidOrder(db,snapshot(1));
  assert.equal(sqlite.prepare('SELECT order_reference r FROM orders').get().r,'NAIS-2026-10000');
});
test('historical migration preserves every existing value and all read paths fall back',async t=>{
  const {sqlite,db}=setup(t,false);await createPaidOrder(db,snapshot(1));
  const before=sqlite.prepare('SELECT * FROM orders').get();
  sqlite.exec(migration('0014_order_reference.sql'));
  assert.deepEqual({...sqlite.prepare('SELECT * FROM orders').get()}, {...before,order_reference:null});
  assert.equal((await getPublicOrder(db,snapshot(1).stripe_checkout_session_id)).orderNumber,before.order_number);
  assert.equal((await getAdminOrder(db,before.id)).orderNumber,before.order_number);
  assert.equal((await readConfirmation(db,snapshot(1).stripe_checkout_session_id)).order_number,before.order_number);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM order_reference_counters').get().n,0);
});
test('public/admin list/detail and all three emails use the short reference',async t=>{
  const {sqlite,db}=setup(t);await createPaidOrder(db,snapshot(1));
  const row=sqlite.prepare('SELECT * FROM orders').get();
  const expected='NAIS-2026-0001';
  assert.equal((await getPublicOrder(db,snapshot(1).stripe_checkout_session_id)).orderNumber,expected);
  const detail=await getAdminOrder(db,row.id);
  assert.equal(detail.orderNumber,expected);
  assert.equal((await listAdminOrders(db,new URLSearchParams())).items[0].orderNumber,expected);
  const emails=[confirmationMessage(await readConfirmation(db,snapshot(1).stripe_checkout_session_id)),
    shippingMessage(detail),notificationMessage(await readNotification(db,snapshot(1).stripe_checkout_session_id),'operations@example.test')];
  for(const email of emails){
    assert.ok(email.text.includes(expected));assert.ok(email.html.includes(expected));
    assert.ok(!email.text.includes(row.order_number));assert.ok(!email.html.includes(row.id));
  }
});
test('independent concurrent SQLite connections receive unique sequential references',async t=>{
  const dir=mkdtempSync(resolve('tmp/order-reference-'));const path=join(dir,'orders.sqlite');
  t.after(()=>{unlinkSync(path);rmdirSync(dir);});
  const sqlite=new DatabaseSync(path);
  sqlite.exec(migration('0003_orders.sql'));sqlite.exec(migration('0014_order_reference.sql'));sqlite.close();
  const gate=new SharedArrayBuffer(4);
  const source=`const {workerData,parentPort}=require('node:worker_threads');
    (async()=>{const {DatabaseSync}=await import('node:sqlite');
      const {createPaidOrder}=await import(workerData.service);
      const sqlite=new DatabaseSync(workerData.path);sqlite.exec('PRAGMA busy_timeout=10000');
      const adapter=${adapter.toString()};
      parentPort.postMessage('ready');Atomics.wait(new Int32Array(workerData.gate),0,0);
      await createPaidOrder(adapter(sqlite),workerData.snapshot);
      sqlite.close();parentPort.postMessage('done');
    })().catch(error=>{throw error;});`;
  const workers=Array.from({length:6},(_,i)=>new Worker(source,{eval:true,workerData:{path,gate,
    service:new URL('./orders/order.service.ts',import.meta.url).href,snapshot:snapshot(i+1)}}));
  t.after(async()=>{await Promise.all(workers.map(worker=>worker.terminate()));});
  const ready=workers.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));
  const complete=workers.map(worker=>new Promise((resolve,reject)=>{worker.once('exit',code=>code===0?resolve():reject(Error('worker failed')));worker.once('error',reject);}));
  await Promise.all(ready);Atomics.store(new Int32Array(gate),0,1);Atomics.notify(new Int32Array(gate),0);
  await Promise.all(complete);
  const result=new DatabaseSync(path);
  try{assert.deepEqual(result.prepare('SELECT order_reference r FROM orders ORDER BY r').all().map(row=>row.r),
    Array.from({length:6},(_,i)=>'NAIS-2026-'+String(i+1).padStart(4,'0')));}finally{result.close();}
});

test('complete ordered migration chain through 0015 preserves reference and delivery defaults', async t=>{
  const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
  for(const name of ['0001_promo_signups.sql','0002_promo_codes.sql','0003_orders.sql','0004_products.sql',
    '0005_seed_products.sql','0006_order_confirmation.sql','0007_shipping_email.sql','0008_promo_email.sql',
    '0009_hide_tropical_hops.sql','0010_assorted_pack_three_flavours.sql','0011_harvest_sold_out.sql',
    '0012_stripe_price_cleanup.sql','0013_order_notification.sql','0014_order_reference.sql','0015_order_archiving.sql']) sqlite.exec(migration(name));
  await createPaidOrder(adapter(sqlite),snapshot(1));
  const row=sqlite.prepare('SELECT * FROM orders').get();
  assert.equal(row.order_reference,'NAIS-2026-0001');
  assert.equal(row.notification_email_status,'pending');
  assert.equal(row.confirmation_email_status,'pending');
  assert.equal(row.shipping_email_status,'pending');
});
