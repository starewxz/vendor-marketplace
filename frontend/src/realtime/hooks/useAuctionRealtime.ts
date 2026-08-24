import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuctionView } from '../../types/auction';
import { realtimeSocket } from '../socket';
import type { AuctionUpdatedEvent } from '../types';

const AUCTION_EVENTS = [
  'auction.bid.updated',
  'auction.started',
  'auction.finalized',
  'auction.won',
  'auction.unsold',
  'auction.purchase_window.opened',
  'auction.purchased',
  'auction.purchase_window.expired',
] as const;

export function useAuctionRealtime(
  auctionId?: string,
  productId?: string,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!auctionId) return;
    const subscribe = () =>
      realtimeSocket.emit('subscribe:auction', { id: auctionId });
    const onAuctionUpdate = (event: AuctionUpdatedEvent) => {
      if (event.auctionId !== auctionId) return;
      if (productId) {
        queryClient.setQueryData<AuctionView>(
          ['auction', 'product', productId],
          (current) => {
            if (!current) return current;
            if (new Date(current.updatedAt).getTime() > new Date(event.updatedAt).getTime()) {
              return current;
            }
            return {
              ...current,
              status: event.status,
              currentPrice: event.currentPrice,
              minNextBid: event.minimumNextBid,
              bidCount: event.bidCount,
              endsAt: event.endsAt,
              purchaseWindowEndsAt: event.purchaseWindowEndsAt,
              updatedAt: event.updatedAt,
            };
          },
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['auction', auctionId, 'bids'] });
      void queryClient.invalidateQueries({ queryKey: ['auction', auctionId, 'winner-state'] });
      void queryClient.invalidateQueries({ queryKey: ['seller-auctions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-auctions'] });
    };

    realtimeSocket.on('connect', subscribe);
    for (const event of AUCTION_EVENTS) realtimeSocket.on(event, onAuctionUpdate);
    if (realtimeSocket.connected) subscribe();
    return () => {
      realtimeSocket.emit('unsubscribe:auction', { id: auctionId });
      realtimeSocket.off('connect', subscribe);
      for (const event of AUCTION_EVENTS) realtimeSocket.off(event, onAuctionUpdate);
    };
  }, [auctionId, productId, queryClient]);
}
