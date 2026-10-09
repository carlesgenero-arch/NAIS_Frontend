/** Server-only contract. Callers provide trusted templates, never raw browser payloads. */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
  readonly replyTo?: string;
}
export interface EmailEnvironment {
  readonly RESEND_API_KEY?: string;
  readonly EMAIL_FROM?: string;
  readonly EMAIL_REPLY_TO?: string;
}
export interface EmailConfiguration {
  readonly apiKey: string;
  readonly from: string;
}
/** Accepted means queued by the provider, NOT delivered to the recipient. */
export type EmailResult = { readonly ok: true; readonly status: 'accepted' }
  | { readonly ok: false; readonly status: 'not_configured' | 'invalid_message' | 'unavailable' };
export type EmailDiagnostic = 'not_configured' | 'invalid_message' | 'network_error'
  | 'timeout' | 'provider_http_error' | 'unexpected_error';
export type EmailTransport = (message: EmailMessage, config: EmailConfiguration) => Promise<EmailResult & { readonly diagnostic?: EmailDiagnostic }>;
