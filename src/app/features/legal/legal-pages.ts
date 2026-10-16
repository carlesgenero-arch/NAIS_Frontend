import type { TranslationKey } from '../../i18n/ca';
interface LegalSection { readonly title: TranslationKey; readonly body: TranslationKey }
interface LegalPageDefinition { readonly title: TranslationKey; readonly sections: readonly LegalSection[] }
const section = (prefix: string): LegalSection => ({ title: `${prefix}.title` as TranslationKey, body: `${prefix}.body` as TranslationKey });
export const LEGAL_PAGES = {
  legal: { title: 'legal.notice.title', sections: ['owner', 'content'].map(key => section(`legal.notice.${key}`)) },
  privacy: { title: 'legal.privacy.title', sections: ['controller', 'promo', 'orders', 'basis', 'providers', 'retention', 'rights'].map(key => section(`legal.privacy.${key}`)) },
  cookies: { title: 'legal.cookies.title', sections: ['storage', 'security', 'analytics', 'controls'].map(key => section(`legal.cookies.${key}`)) },
  'purchase-conditions': { title: 'legal.purchase.title', sections: ['seller', 'prices', 'payment', 'delivery', 'availability'].map(key => section(`legal.purchase.${key}`)) },
  'shipping-returns': { title: 'legal.returns.title', sections: ['shipping', 'storage', 'withdrawal', 'incidents'].map(key => section(`legal.returns.${key}`)) },
  contact: { title: 'legal.contact.title', sections: [section('legal.contact.details')] },
} as const satisfies Record<string, LegalPageDefinition>;
export type LegalPageId = keyof typeof LEGAL_PAGES;
export const LEGAL_LINKS: readonly { label: TranslationKey; url: string }[] = [
  { label: 'legal.notice.title', url: '/legal' },
  { label: 'legal.privacy.title', url: '/privacy' },
  { label: 'legal.cookies', url: '/cookies' },
  { label: 'legal.purchase.title', url: '/purchase-conditions' },
  { label: 'legal.shipping', url: '/shipping-returns' },
  { label: 'legal.contact', url: '/contact' },
];
