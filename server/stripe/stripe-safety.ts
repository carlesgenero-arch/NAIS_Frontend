/** Server-owned opt-in; never derive payment mode from browser input. */
export interface StripeSafetyEnvironment {
  NAIS_ENVIRONMENT?: string;
  STRIPE_SECRET_KEY?: string;
}

export function assertStripeConfiguration(env: StripeSafetyEnvironment): void {
  if (env.NAIS_ENVIRONMENT !== 'uat') return;
  if (!/^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY ?? '')) {
    throw new Error('UAT Stripe TEST configuration required');
  }
}

const modeObjects = new Set(['product', 'price', 'coupon', 'promotion_code', 'checkout.session',
  'event', 'payment_intent', 'customer']);

/** Reject LIVE anywhere in an expanded response; missing mode is not proof of TEST. */
export function assertStripeTestObject(env: StripeSafetyEnvironment, value: unknown, requireMode = true): void {
  if (env.NAIS_ENVIRONMENT !== 'uat') return;
  if (!value || typeof value !== 'object') throw new Error('UAT Stripe TEST response required');
  const root = value as Record<string, unknown>;
  if (requireMode && root['livemode'] !== false) throw new Error('UAT Stripe TEST response required');
  function inspect(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(inspect); return; }
    const row = node as Record<string, unknown>;
    if (row['livemode'] === true || (typeof row['object'] === 'string'
      && modeObjects.has(row['object']) && row['livemode'] !== false)) {
      throw new Error('UAT Stripe TEST response required');
    }
    Object.values(row).forEach(inspect);
  }
  inspect(value);
}

/** One boundary for SDK calls and injected test clients. Production returns the original client. */
export function guardedStripeClient<T extends object>(env: StripeSafetyEnvironment, factory: () => T): T {
  assertStripeConfiguration(env);
  const client = factory();
  if (env.NAIS_ENVIRONMENT !== 'uat') return client;
  function resource<R extends object>(target: R): R {
    return new Proxy(target, { get(original, property, receiver) {
      const member = Reflect.get(original, property, receiver);
      if (typeof member !== 'function') return member;
      return async (...args: unknown[]) => {
        const result = await Reflect.apply(member, original, args);
        if (property === 'list' || property === 'listLineItems') {
          if (!result || !Array.isArray(result.data)) throw new Error('UAT Stripe TEST list required');
          for (const item of result.data) assertStripeTestObject(env, item, property !== 'listLineItems');
          assertStripeTestObject(env, result, false);
        } else {
          assertStripeTestObject(env, result);
        }
        return result;
      };
    } });
  }
  return new Proxy(client, { get(target, property, receiver) {
    const member = Reflect.get(target, property, receiver);
    if (['products', 'prices', 'coupons', 'promotionCodes'].includes(String(property)) && member) return resource(member);
    if (property === 'checkout' && member) return new Proxy(member, { get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      return property === 'sessions' && value && typeof value === 'object' ? resource(value) : value;
    } });
    return member;
  } });
}
