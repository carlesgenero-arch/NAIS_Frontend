import { PromoSignupService } from './promo-signup.service';

describe('PromoSignupService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([[201, 'registered'], [200, 'already_registered'], [400, 'invalid_email']] as const)(
    'accepts server response %s %s and sends email plus verification token', async (status, result) => {
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: result }, { status }));
      vi.stubGlobal('fetch', fetchMock);
      expect(await new PromoSignupService().register('user@example.com', 'test-token')).toBe(result);
      expect(fetchMock).toHaveBeenCalledWith('/api/promo-signup', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ email: 'user@example.com', turnstileToken: 'test-token' }),
        headers: { 'Content-Type': 'application/json' },
      }));
    },
  );

  it('allows the serial verification/Stripe/email work to finish beyond the old 15-second cutoff', async () => {
    vi.useFakeTimers();
    try {
      let requestSignal!: AbortSignal;
      vi.stubGlobal('fetch', vi.fn((_url, options) => {
        requestSignal = options.signal;
        return new Promise<Response>(resolve => {
          setTimeout(() => resolve(Response.json({ status: 'registered' }, { status: 201 })), 20_000);
        });
      }));
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      const result = new PromoSignupService().register('user@example.com', 'fresh-token');
      await vi.advanceTimersByTimeAsync(20_000);
      expect(await result).toBe('registered');
      expect(requestSignal.aborted).toBe(false);
      expect(timeout).toHaveBeenCalledWith(120_000);
      timeout.mockRestore();
    } finally { vi.useRealTimers(); }
  });

  it('fails safely on network errors or malformed responses', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('not json'))
      .mockResolvedValueOnce(Response.json({ status: 'registered' }, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new PromoSignupService();
    for (let i = 0; i < 3; i++) expect(await service.register('user@example.com', 'test-token')).toBe('unavailable');
  });
});
