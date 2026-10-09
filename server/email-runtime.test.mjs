import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
// Already installed through Wrangler; no new runtime or application dependency.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('real workerd transport: unsupported redirect reproduced, manual + timeout works without following redirects', async () => {
  const source = await readFile(new URL('./email/resend.transport.ts', import.meta.url), 'utf8');
  const transport = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  let calls = 0;
  let redirect = false;
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, compatibilityDate: '2026-09-01',
    script: `${transport}
      export default { async fetch(req) {
        if (new URL(req.url).pathname === '/old') {
          try { const request = fetch; await request('https://api.resend.com/emails', {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000)
          }); return Response.json({unexpected: true}); }
          catch (error) { return Response.json({typeError: error instanceof TypeError}); }
        }
        return Response.json(await resendTransport({to:'recipient@example.test',subject:'Test',html:'<p>Test</p>'},
          {apiKey:'re_synthetic',from:'sender@example.test'}));
      }}
    `,
    outboundService: async request => {
      calls++;
      assert.equal(request.url, 'https://api.resend.com/emails');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.get('Authorization'), 'Bearer re_synthetic');
      assert.equal(request.headers.get('Content-Type'), 'application/json');
      assert.equal((await request.json()).subject, 'Test');
      return redirect ? new Response(null, { status: 302, headers: { Location: 'https://other.example' } })
        : Response.json({ id: 'synthetic' });
    },
  }));
  try {
    assert.deepEqual(await (await mf.dispatchFetch('http://localhost/old')).json(), { typeError: true });
    assert.equal(calls, 0);
    assert.deepEqual(await (await mf.dispatchFetch('http://localhost/new')).json(), { ok: true, status: 'accepted' });
    assert.equal(calls, 1);
    redirect = true;
    assert.deepEqual(await (await mf.dispatchFetch('http://localhost/new')).json(), {
      ok: false, status: 'unavailable', diagnostic: 'provider_http_error',
    });
    assert.equal(calls, 2);
  } finally { await mf.dispose(); }
});
