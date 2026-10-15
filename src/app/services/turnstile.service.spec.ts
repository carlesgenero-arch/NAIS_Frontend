import { TestBed } from '@angular/core/testing';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  afterEach(() => { vi.unstubAllGlobals(); Reflect.deleteProperty(window, 'turnstile'); });

  it('renders a compact contextual widget, clears expired/error tokens and supports reset/removal', async () => {
    const render = vi.fn().mockReturnValue('widget');
    const execute = vi.fn(); const reset = vi.fn(); const remove = vi.fn(); const token = vi.fn(); const failed = vi.fn();
    Object.assign(window, { turnstile: { render, execute, reset, remove } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteKey: 'public-key' })));
    const handle = await TestBed.inject(TurnstileService).mount(document.createElement('div'), 'es', token, failed);
    const options = render.mock.calls[0][1];
    expect(options).toMatchObject({ sitekey: 'public-key', size: 'compact', action: 'promo_signup',
      execution: 'execute', appearance: 'interaction-only', language: 'es', 'response-field': false });
    expect(JSON.stringify(options)).not.toContain('SECRET');
    expect(execute).not.toHaveBeenCalled();
    handle.execute();
    expect(execute).toHaveBeenCalledWith('widget');
    options.callback('token');
    expect(token).toHaveBeenLastCalledWith('token');
    options['expired-callback']();
    expect(token).toHaveBeenLastCalledWith('');
    options['error-callback']();
    expect(failed).toHaveBeenCalledTimes(2);
    handle.reset(); handle.destroy();
    expect(reset).toHaveBeenCalledWith('widget'); expect(remove).toHaveBeenCalledWith('widget');
  });

  it('fails safely without rendering when public configuration is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'unavailable' }, { status: 503 })));
    await expect(TestBed.inject(TurnstileService).mount(document.createElement('div'), 'ca', vi.fn(), vi.fn()))
      .rejects.toThrow('Verification unavailable');
  });
});
