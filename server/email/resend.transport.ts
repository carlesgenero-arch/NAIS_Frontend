import type { EmailConfiguration, EmailDiagnostic, EmailException, EmailMessage, EmailResult } from './email.types.ts';

/** The only module that knows Resend's URL, authorization and wire format. No automatic retries. */
export async function resendTransport(message: EmailMessage, config: EmailConfiguration,
  request: typeof fetch = fetch): Promise<EmailResult & { readonly diagnostic?: EmailDiagnostic; readonly exception?: EmailException }> {
  let fetching = false;
  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(10000);
    fetching = true;
    const response = await request('https://api.resend.com/emails', {
      // workerd supports manual/follow, not error. Never forward credentials on redirects.
      method: 'POST', redirect: 'manual', signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, html: message.html,
        ...(message.text !== undefined ? { text: message.text } : {}),
        ...(message.replyTo !== undefined ? { reply_to: message.replyTo } : {}) }),
    });
    fetching = false;
    // Do not parse, log or return provider error bodies: they can contain recipient data.
    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* Preserve the known HTTP failure category. */ }
      return { ok: false, status: 'unavailable', diagnostic: 'provider_http_error' };
    }
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('id' in value)
      || typeof value.id !== 'string' || !value.id.trim()) return { ok: false, status: 'unavailable', diagnostic: 'unexpected_error' };
    return { ok: true, status: 'accepted' };
  } catch (error) {
    // Includes timeout, network errors, redirects and malformed provider responses.
    const timeout = signal?.aborted || (error instanceof Error && error.name === 'TimeoutError');
    const name = error instanceof Error ? error.name : '';
    const exception: EmailException = name === 'TypeError' || name === 'AbortError' || name === 'TimeoutError' ? name : 'OtherError';
    return { ok: false, status: 'unavailable', diagnostic: timeout ? 'timeout' : fetching ? 'network_error' : 'unexpected_error', exception };
  }
}
