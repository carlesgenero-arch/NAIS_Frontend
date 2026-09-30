import { promoSignup, type PromoEnvironment } from '../../server/promo-signup.ts';

export function onRequest(context: { request: Request; env: PromoEnvironment }): Promise<Response> {
  return promoSignup(context.request, context.env);
}
