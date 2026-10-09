import type { EmailDiagnostic, EmailEnvironment, EmailException, EmailMessage, EmailResult, EmailTransport } from './email.types.ts';
import { resendTransport } from './resend.transport.ts';

function address(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 254 || /[\r\n]/.test(value)) return null;
  const trimmed = value.trim();
  return /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(trimmed) ? trimmed : null;
}
function sender(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 320 || /[\r\n]/.test(value)) return null;
  if (address(value)) return value.trim();
  const match = /^([^<>]+) <([^<>]+)>$/.exec(value.trim());
  return match && match[1]!.trim() && address(match[2]) ? value.trim() : null;
}

/** Future business services call this function; never import Resend or its transport directly. */
export async function sendEmail(message: EmailMessage, env: EmailEnvironment,
  transport: EmailTransport = resendTransport,
  diagnose?: (category: EmailDiagnostic, exception?: EmailException) => void): Promise<EmailResult> {
  const key = env.RESEND_API_KEY;
  const from = sender(env.EMAIL_FROM);
  const defaultReplyTo = env.EMAIL_REPLY_TO === undefined ? undefined : address(env.EMAIL_REPLY_TO);
  if (typeof key !== 'string' || !key.trim() || /\s/.test(key.trim()) || !from || defaultReplyTo === null) {
    diagnose?.('not_configured');
    return { ok: false, status: 'not_configured' };
  }
  if (!message || typeof message !== 'object') {
    diagnose?.('invalid_message');
    return { ok: false, status: 'invalid_message' };
  }
  const to = address(message.to);
  const replyTo = message.replyTo === undefined ? defaultReplyTo : address(message.replyTo);
  if (!to || replyTo === null || typeof message.subject !== 'string' || !message.subject.trim()
    || /[\r\n]/.test(message.subject) || typeof message.html !== 'string' || !message.html.trim()
    || (message.text !== undefined && typeof message.text !== 'string')) {
    diagnose?.('invalid_message');
    return { ok: false, status: 'invalid_message' };
  }
  try {
    const result = await transport({ to, subject: message.subject.trim(), html: message.html,
      ...(message.text !== undefined ? { text: message.text } : {}),
      ...(replyTo !== undefined ? { replyTo } : {}) }, { apiKey: key.trim(), from });
    // Project the result so provider metadata never escapes through this boundary.
    if (!result.ok) {
      const category = result.diagnostic;
      const name = result.exception;
      const exception = name === 'TypeError' || name === 'AbortError' || name === 'TimeoutError' || name === 'OtherError' ? name : undefined;
      diagnose?.(category === 'network_error' || category === 'timeout' || category === 'provider_http_error'
        ? category : 'unexpected_error', exception);
    }
    return result.ok === true && result.status === 'accepted'
      ? { ok: true, status: 'accepted' } : { ok: false, status: 'unavailable' };
  } catch {
    diagnose?.('unexpected_error');
    return { ok: false, status: 'unavailable' };
  }
}
