import { stripeWebhook, type WebhookEnvironment } from '../../server/stripe/stripe-webhook.ts';

export function onRequest(context: { request: Request; env: WebhookEnvironment }): Promise<Response> {
  return stripeWebhook(context.request, context.env);
}
