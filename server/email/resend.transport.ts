import type { EmailConfiguration, EmailMessage, EmailResult } from './email.types.ts';

/** The only module that knows Resend's URL, authorization and wire format. No automatic retries. */
export async function resendTransport(message: EmailMessage, config: EmailConfiguration,
  request: typeof fetch = fetch): Promise<EmailResult> {
  try {
    const response = await request('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, html: message.html,
        ...(message.text !== undefined ? { text: message.text } : {}),
        ...(message.replyTo !== undefined ? { reply_to: message.replyTo } : {}) }),
    });
    // Do not parse, log or return provider error bodies: they can contain recipient data.
    if (!response.ok) { await response.body?.cancel(); return { ok: false, status: 'unavailable' }; }
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('id' in value)
      || typeof value.id !== 'string' || !value.id.trim()) return { ok: false, status: 'unavailable' };
    return { ok: true, status: 'accepted' };
  } catch {
    // Includes timeout, network errors, redirects and malformed provider responses.
    return { ok: false, status: 'unavailable' };
  }
}
