import { TestBed } from '@angular/core/testing';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  afterEach(() => { vi.unstubAllGlobals(); Reflect.deleteProperty(window, 'turnstile'); });

  function provider() {
    const render = vi.fn().mockReturnValue('widget');
    const execute = vi.fn(); const reset = vi.fn(); const remove = vi.fn();
    Object.assign(window, { turnstile: { render, execute, reset, remove } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteKey: 'public-key' })));
    return { render, execute, reset, remove };
  }

  it('executes once and delivers one fresh token, ignoring later expiry/error callbacks', async () => {
    const api = provider(); const token = vi.fn(); const failed = vi.fn();
    const handle = await TestBed.inject(TurnstileService).mount(document.createElement('div'), 'es', token, failed);
    const options = api.render.mock.calls[0][1];
    expect(options).toMatchObject({ sitekey: 'public-key', size: 'compact', action: 'promo_signup',
      execution: 'execute', appearance: 'interaction-only', language: 'es', 'response-field': false,
      retry: 'never', 'refresh-expired': 'never', 'refresh-timeout': 'never' });
    expect(api.execute).not.toHaveBeenCalled();
    handle.execute(); handle.execute();
    expect(api.execute).toHaveBeenCalledExactlyOnceWith('widget');
    options.callback('latest-token'); options.callback('duplicate-token');
    options['expired-callback'](); options['error-callback']();
    expect(token).toHaveBeenCalledExactlyOnceWith('latest-token');
    expect(failed).not.toHaveBeenCalled();
    handle.destroy(); handle.destroy();
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('widget');
  });

  it.each(['error-callback', 'expired-callback', 'timeout-callback'])(
    'settles %s once; late successes and callbacks after removal cannot submit', async callback => {
      const api = provider(); const token = vi.fn(); const failed = vi.fn();
      const handle = await TestBed.inject(TurnstileService).mount(document.createElement('div'), 'ca', token, failed);
      const options = api.render.mock.calls[0][1];
      handle.execute(); options[callback](); options[callback](); options.callback('stale-token');
      expect(failed).toHaveBeenCalledOnce(); expect(token).not.toHaveBeenCalled();
      handle.destroy(); options.callback('late-token'); handle.execute(); handle.reset();
      expect(token).not.toHaveBeenCalled(); expect(api.reset).not.toHaveBeenCalled();
      expect(api.execute).toHaveBeenCalledOnce();
    },
  );

  it('does not execute if the provider fails during render', async () => {
    const api = provider(); const failed = vi.fn();
    api.render.mockImplementation((_container, options) => { options['error-callback'](); return 'widget'; });
    const handle = await TestBed.inject(TurnstileService).mount(document.createElement('div'), 'ca', vi.fn(), failed);
    handle.execute();
    expect(failed).toHaveBeenCalledOnce(); expect(api.execute).not.toHaveBeenCalled();
    handle.destroy();
  });

  it('fails safely without rendering when public configuration is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'unavailable' }, { status: 503 })));
    await expect(TestBed.inject(TurnstileService).mount(document.createElement('div'), 'ca', vi.fn(), vi.fn()))
      .rejects.toThrow('Verification unavailable');
  });
});
