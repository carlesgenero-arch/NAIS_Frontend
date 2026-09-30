import { PromoSignupService } from './promo-signup.service';

describe('PromoSignupService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([[201, 'registered'], [200, 'already_registered'], [400, 'invalid_email']] as const)(
    'accepts server response %s %s and sends only email', async (status, result) => {
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: result }, { status }));
      vi.stubGlobal('fetch', fetchMock);
      expect(await new PromoSignupService().register('user@example.com')).toBe(result);
      expect(fetchMock).toHaveBeenCalledWith('/api/promo-signup', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ email: 'user@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      }));
    },
  );

  it('fails safely on network errors or malformed responses', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('not json'))
      .mockResolvedValueOnce(Response.json({ status: 'registered' }, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new PromoSignupService();
    for (let i = 0; i < 3; i++) expect(await service.register('user@example.com')).toBe('unavailable');
  });
});
