import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { promoMessage } from './promotions/promo-email.ts';

test('promo email matches confirmation surfaces, hierarchy and footer without remote assets', () => {
  const message = promoMessage('person@example.test', 'NAIS-DEMO-10', 'https://naisdrinks.com');
  const document = new JSDOM(message.html).window.document;
  assert.equal(message.to, 'person@example.test');
  assert.equal(message.subject, 'NAIS — El teu codi del 10%');
  assert.equal(document.documentElement.lang, 'ca');
  assert.equal(document.querySelector('h1').textContent, 'Un 10% per a la teva primera comanda');
  assert.match(document.body.getAttribute('style'), /background-color:#ECE3D8/);
  assert.match(document.body.getAttribute('style'), /Arial,Helvetica,sans-serif/);
  assert.ok(document.querySelector('table[style*="max-width:600px"][style*="background-color:#FFFFFF"]'));
  assert.ok(document.querySelector('td[style*="background-color:#F6D03E"]'));
  assert.equal(document.querySelector('#promo-code').textContent, 'NAIS-DEMO-10');
  assert.match(document.querySelector('#promo-code').closest('table').getAttribute('style'), /background-color:#18181A;color:#FFFFFF/);
  assert.equal(document.querySelector('a[href^="mailto:"]').getAttribute('href'), 'mailto:info@naisdrinks.com');
  assert.match(document.body.textContent, /Codi d’un sol ús, vàlid per a la primera comanda\./);
  assert.equal(document.querySelectorAll('script, style, link, img, iframe, form').length, 0);
  assert.ok([...document.querySelectorAll('table')].every(table => table.getAttribute('role') === 'presentation'));
  assert.match(message.html, /\[if mso\]/);
});

for (const site of ['https://naisdrinks.com', 'https://uat.naisdrinks.com/', 'http://localhost:4200', 'http://127.0.0.1:4200', 'http://[::1]:4200']) {
  test('CTA and plain text use configured origin and /home: ' + site, () => {
    const message = promoMessage('person@example.test', 'DEMO10', site);
    const document = new JSDOM(message.html).window.document;
    const cta = [...document.querySelectorAll('a')].find(link => link.textContent === 'DESCOBREIX NAIS');
    assert.equal(cta.getAttribute('href'), new URL('/home', site).href);
    assert.match(cta.getAttribute('style'), /padding:14px 22px/);
    assert.ok(message.text.includes(`DESCOBREIX NAIS\n${new URL('/home', site).href}`));
    assert.equal(document.querySelectorAll('a[href="/"]').length, 0);
  });
}

for (const site of [undefined, '', 'not a URL', 'javascript:alert(1)', 'data:text/html,test', '//evil.example',
  'http://evil.example', 'https://user:password@naisdrinks.com', 'https://naisdrinks.com/other',
  'https://naisdrinks.com/?next=evil', 'https://naisdrinks.com/#fragment', 'https://naisdrinks.com/" onclick="alert(1)']) {
  test('missing or unsafe origin never creates a CTA or interrupts the email: ' + site, () => {
    const message = promoMessage('person@example.test', 'DEMO10', site);
    const document = new JSDOM(message.html).window.document;
    assert.equal(document.querySelectorAll('a:not([href^="mailto:"])').length, 0);
    assert.equal(document.querySelector('#promo-code').textContent, 'DEMO10');
    assert.ok(message.text.includes('DEMO10'));
    assert.ok(!message.text.includes('DESCOBREIX NAIS'));
  });
}

test('dynamic code stays escaped, selectable and intact in the text fallback', () => {
  const code = `<script>alert("&'")</script>`;
  const message = promoMessage('person@example.test', code, 'https://uat.naisdrinks.com');
  const document = new JSDOM(message.html).window.document;
  assert.equal(document.querySelector('#promo-code').textContent, code);
  assert.equal(document.querySelectorAll('script').length, 0);
  assert.match(message.html, /&lt;script&gt;alert\(&quot;&amp;&#39;&quot;\)&lt;\/script&gt;/);
  assert.ok(!message.html.includes('person@example.test'));
  assert.ok(message.text.startsWith(['NAIS — Un 10% per a la teva primera comanda',
    'Gràcies per descobrir NAIS! Utilitza aquest codi al pagament per obtenir un 10% de descompte:',
    code, 'Codi d’un sol ús, vàlid per a la primera comanda.'].join('\n\n')));
  assert.ok(message.text.endsWith('NAIS Drinks\nTens cap dubte? Escriu-nos a info@naisdrinks.com'));
});

test('long Stripe promotion codes can wrap inside the fluid email', () => {
  const code = 'NAIS'.repeat(50);
  const document = new JSDOM(promoMessage('person@example.test', code, 'https://naisdrinks.com').html).window.document;
  const block = document.querySelector('#promo-code');
  assert.equal(block.textContent, code);
  assert.match(block.getAttribute('style'), /overflow-wrap:anywhere/);
  assert.match(block.closest('table').getAttribute('style'), /width:100%;table-layout:fixed/);
});
