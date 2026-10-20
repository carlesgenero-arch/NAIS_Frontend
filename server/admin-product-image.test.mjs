import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { requireAdmin } from './admin/admin-auth.ts';
import { onRequest as upload } from '../functions/api/admin/products/[id]/image.ts';
import { onRequest as serve } from '../functions/images/uploads/[[path]].ts';
import { MAX_PRODUCT_IMAGE_BYTES, MAX_UPLOAD_BYTES } from './images/product-images.ts';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvWQAAAAASUVORK5CYII=','base64');
const jpeg=readFileSync(new URL('../public/images/info-card/lemon.jpg',import.meta.url));
const webp=Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==','base64');
const env={ACCESS_TEAM_DOMAIN:'https://test.cloudflareaccess.com',ACCESS_AUD:'image-tests',ADMIN_EMAILS:'admin@example.test'};
const {privateKey,publicKey}=await generateKeyPair('RS256');
const keys=createLocalJWKSet({keys:[{...await exportJWK(publicKey),kid:'test'}]});
async function token(email='admin@example.test') {return new SignJWT({type:'app',email}).setProtectedHeader({alg:'RS256',kid:'test'})
  .setSubject('fixture').setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(env.ACCESS_AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);}
function multipart(bytes=png,mime='image/png',filename='../../untrusted.jpg') {const form=new FormData();form.append('image',new File([bytes],filename,{type:mime}));return form;}
async function setup(t) {
  const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
  for(const name of ['0004_products.sql','0005_seed_products.sql'])sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const objects=new Map([['legacy-do-not-delete',new Uint8Array([1])]]);const calls=[];
  const bucket={async put(key,bytes,options){calls.push({key,bytes:new Uint8Array(bytes),options});objects.set(key,new Uint8Array(bytes));return {key};},
    async get(key){const bytes=objects.get(key);return bytes?{body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}}),httpEtag:'"fixture"'}:null;}};
  const db={prepare(sql){return {values:[],bind(...values){this.values=values;return this;},async first(){return sqlite.prepare(sql).get(...this.values)??null;}};}};
  const signed=await token();
  async function send(form=multipart(),options={}) {
    const request=new Request('https://nais.example/api/admin/products/'+(options.id??'orange-spritz')+'/image',{
      method:options.method??'POST',headers:{Origin:options.origin??'https://nais.example',
        ...(options.jwt===null?{}:{'Cf-Access-Jwt-Assertion':options.jwt??signed}),...options.headers},body:form});
    const context={request,env:{...env,PROMO_DB:options.db===undefined?db:options.db,PRODUCT_IMAGES:options.bucket===undefined?bucket:options.bucket},
      params:{id:options.id??'orange-spritz'},data:{},next:()=>upload(context)};
    return requireAdmin(context,()=>keys);
  }
  return {sqlite,db,bucket,objects,calls,send};
}
for(const [name,bytes,mime,extension] of [['PNG',png,'image/png','png'],['JPEG',jpeg,'image/jpeg','jpg'],['WebP',webp,'image/webp','webp']])
 test('valid '+name+' uploads using generated key and updates only D1 image fields',async t=>{
  const {send,sqlite,calls,objects}=await setup(t);const before=sqlite.prepare("SELECT * FROM products WHERE id='orange-spritz'").get();
  const response=await send(multipart(bytes,mime));assert.equal(response.status,200);const result=await response.json();
  assert.equal(calls.length,1);assert.match(calls[0].key,new RegExp('^products/orange-spritz/[a-f0-9-]{36}\\.'+extension+'$'));
  assert.equal(result.imageUrl,'/images/uploads/'+calls[0].key);assert.equal(calls[0].options.httpMetadata.contentType,mime);
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(objects.has('legacy-do-not-delete'),true);
  const after=sqlite.prepare("SELECT * FROM products WHERE id='orange-spritz'").get();
  assert.deepEqual({...after},{...before,image_url:result.imageUrl,updated_at:result.updatedAt});
  const served=await serve({request:new Request('https://nais.example'+result.imageUrl),env:{PRODUCT_IMAGES:(await setupBucket(objects))},params:{path:calls[0].key.split('/')}});
  assert.equal(served.status,200);assert.equal(served.headers.get('Content-Type'),mime);
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()),new Uint8Array(bytes));
});
function setupBucket(objects){return {get:async key=>objects.has(key)?{body:new Blob([objects.get(key)]).stream(),httpEtag:'"fixture"'}:null};}

test('unsupported MIME, mismatched signature, SVG and empty files are rejected',async t=>{
 const {send,calls}=await setup(t);
 for(const [bytes,mime] of [[png,'text/html'],[png,'image/jpeg'],[Buffer.from('<svg></svg>'),'image/png'],[Buffer.alloc(12),'image/webp']]){
   assert.equal((await send(multipart(bytes,mime))).status,415);
 }
 assert.equal((await send(multipart(Buffer.alloc(0)))).status,400);assert.equal(calls.length,0);
});
test('file and complete multipart envelope are bounded even without honest length headers',async t=>{
 const {send,calls}=await setup(t);
 assert.equal((await send(multipart(new Uint8Array(MAX_PRODUCT_IMAGE_BYTES+1)))).status,413);
 assert.equal((await send(multipart(),{headers:{'Content-Length':String(MAX_UPLOAD_BYTES+1)}})).status,413);
 assert.equal((await send('x'.repeat(MAX_UPLOAD_BYTES+1),{headers:{'Content-Type':'multipart/form-data; boundary=test','Content-Length':'1'}})).status,413);
 assert.equal(calls.length,0);
});
test('malformed multipart, missing/duplicate image and extra browser fields are rejected',async t=>{
 const {send,calls}=await setup(t);
 assert.equal((await send('broken',{headers:{'Content-Type':'multipart/form-data; boundary=test'}})).status,400);
 assert.equal((await send(multipart(),{headers:{'Content-Type':'application/json'}})).status,400);
 for(const form of [new FormData(),(()=>{const f=multipart();f.append('image',new File([png],'second.png',{type:'image/png'}));return f;})(),
   (()=>{const f=multipart();f.append('imageUrl','https://untrusted.example');return f;})(),(()=>{const f=new FormData();f.append('image','not a file');return f;})()]) {
   assert.equal((await send(form)).status,400);
 }
 assert.equal(calls.length,0);
});
test('JWT, allowlist and same-origin checks reject before D1 or R2',async t=>{
 const {send,calls}=await setup(t);const db={prepare(){assert.fail('Must not access D1');}};
 for(const [options,status] of [[{jwt:null},401],[{jwt:'bad'},401],[{jwt:await token('other@example.test')},403],[{origin:'https://other.example'},403]]){
   const response=await send(multipart(),{...options,db});assert.equal(response.status,status);
 }
 assert.equal(calls.length,0);
});
test('valid ID/existing product and both server bindings are required',async t=>{
 const {send,calls}=await setup(t);
 assert.equal((await send(multipart(),{id:'../bad'})).status,400);
 assert.equal((await send(multipart(),{id:'not-found'})).status,404);
 assert.equal((await send(multipart(),{bucket:null})).status,503);
 assert.equal((await send(multipart(),{db:null})).status,503);
 assert.equal((await send(null,{method:'DELETE'})).status,405);assert.equal(calls.length,0);
});
test('R2 failure and D1 failure preserve old image and expose only generic errors',async t=>{
 const {send,sqlite,db,calls,objects}=await setup(t);const old=sqlite.prepare("SELECT image_url FROM products WHERE id='orange-spritz'").get().image_url;
 const fail={put:async()=>{throw Error('private storage error');}};
 let response=await send(multipart(),{bucket:fail});assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'unavailable'});
 assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='orange-spritz'").get().image_url,old);
 const failingDb={prepare(sql){if(sql.startsWith('UPDATE products'))throw Error('private SQL');return db.prepare(sql);}};
 response=await send(multipart(),{db:failingDb});assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{status:'unavailable'});assert.equal(calls.length,1);
 assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='orange-spritz'").get().image_url,old);
 assert.ok(objects.has(calls[0].key));assert.ok(objects.has('legacy-do-not-delete'));
});
test('concurrent replacement never overwrites a changed image; successful replacement keeps old R2 object',async t=>{
 const {send,sqlite,bucket,objects,calls}=await setup(t);
 const first=await (await send()).json();
 const firstKey=first.imageUrl.replace('/images/uploads/','');
 const second=await (await send()).json();assert.notEqual(first.imageUrl,second.imageUrl);assert.ok(objects.has(firstKey));
 const race={...bucket,async put(...args){const result=await bucket.put(...args);sqlite.exec("UPDATE products SET image_url='images/concurrent.png' WHERE id='orange-spritz'");return result;}};
 assert.equal((await send(multipart(),{bucket:race})).status,409);
 assert.equal(sqlite.prepare("SELECT image_url FROM products WHERE id='orange-spritz'").get().image_url,'images/concurrent.png');
 assert.equal(new Set(calls.map(call=>call.key)).size,calls.length);
});
test('public delivery is read-only, validates exact keys and returns no bucket listing',async t=>{
 const {bucket}=await setup(t);
 for(const path of ['../secret','products/orange-spritz/file.svg','products/../../secret','', 'products/orange-spritz/00000000-0000-0000-0000-000000000001.png']){
  assert.equal((await serve({request:new Request('https://nais.example/images/uploads/test'),env:{PRODUCT_IMAGES:bucket},params:{path}})).status,404);
 }
 assert.equal((await serve({request:new Request('https://nais.example/images/uploads/test',{method:'POST'}),env:{PRODUCT_IMAGES:bucket},params:{path:'x'}})).status,405);
});
