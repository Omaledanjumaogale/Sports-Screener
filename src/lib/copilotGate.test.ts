import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/api/_middleware.js';

afterEach(() => vi.unstubAllGlobals());

function context(headers: Record<string, string> = {}, method = 'POST') {
  return {
    request: new Request('https://app.example/api/ai-analyze', { method, headers, body: method === 'POST' ? JSON.stringify({ messages: [{ role: 'user', content: 'Analyze this market' }] }) : undefined }),
    env: { PUBLIC_CONVEX_URL: 'https://backend.convex.cloud' },
    next: vi.fn(async () => new Response('provider called'))
  };
}

describe('Copilot provider authorization boundary', () => {
  it('rejects oversized streaming bodies without Content-Length', async () => {
    const ctx=context({Authorization:'Bearer token'});
    ctx.request=new Request('https://app.example/api/ai-analyze',{method:'POST',headers:{Authorization:'Bearer token'},body:'x'.repeat(131073)});
    expect((await onRequest(ctx)).status).toBe(413);expect(ctx.next).not.toHaveBeenCalled();
  });
  it('rejects malformed messages before any provider request', async () => {
    const ctx=context({Authorization:'Bearer token'});
    ctx.request=new Request('https://app.example/api/ai-analyze',{method:'POST',headers:{Authorization:'Bearer token'},body:JSON.stringify({messages:[{role:'tool',content:'invalid'}]})});
    expect((await onRequest(ctx)).status).toBe(400);expect(ctx.next).not.toHaveBeenCalled();
  });
  it('rejects anonymous requests before reaching a provider', async () => {
    const ctx = context();
    expect((await onRequest(ctx)).status).toBe(401);
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it('rejects cross-origin requests', async () => {
    const ctx = context({ Origin: 'https://attacker.example', Authorization: 'Bearer token' });
    expect((await onRequest(ctx)).status).toBe(403);
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 'error' }, 403],
    [{ status: 'success', value: { allowed: false } }, 429]
  ])('rejects entitlement or quota denial', async (result, status) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(result)));
    const ctx = context({ Authorization: 'Bearer verified-by-convex' });
    expect((await onRequest(ctx)).status).toBe(status);
    expect(ctx.next).not.toHaveBeenCalled();
  });

  it('passes the bearer token to Convex and allows only an approved request', async () => {
    const verify = vi.fn(async () => Response.json({ status: 'success', value: { allowed: true } }));
    vi.stubGlobal('fetch', verify);
    const ctx = context({ Authorization: 'Bearer verified-by-convex' });
    expect(await (await onRequest(ctx)).text()).toBe('provider called');
    expect(verify).toHaveBeenCalledWith('https://backend.convex.cloud/api/mutation', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer verified-by-convex' })
    }));
  });

  it('fails closed during a verification outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const ctx = context({ Authorization: 'Bearer token' });
    expect((await onRequest(ctx)).status).toBe(503);
    expect(ctx.next).not.toHaveBeenCalled();
  });
});
