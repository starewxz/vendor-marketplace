import { describe, expect, it, vi } from 'vitest';
import { resyncAuthoritativeState } from './resync';

describe('reconnect REST resync', () => {
  it('invalidates authoritative auction/product and seller order queries after reconnect', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await resyncAuthoritativeState({ invalidateQueries }, 'SELLER');

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['products'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['auction'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['seller-orders'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['seller-auctions'] });
  });

  it('keeps anonymous reconnect resync limited to public read models', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await resyncAuthoritativeState({ invalidateQueries });

    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['seller-orders'] });
  });
});
