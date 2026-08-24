import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeSocket } from '../socket';
import type { OrderStatusUpdatedEvent } from '../types';

export function useOrderRealtime(options: {
  orderId?: string;
  sellerOrderId?: string;
} = {}): void {
  const queryClient = useQueryClient();
  const { orderId, sellerOrderId } = options;

  useEffect(() => {
    const subscribe = () => {
      if (orderId) realtimeSocket.emit('subscribe:order', { id: orderId });
    };
    const onOrderStatus = (event: OrderStatusUpdatedEvent) => {
      if (orderId && event.orderId !== orderId) return;
      if (sellerOrderId && event.sellerOrderId !== sellerOrderId) return;
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    };

    realtimeSocket.on('connect', subscribe);
    realtimeSocket.on('order.status.updated', onOrderStatus);
    if (realtimeSocket.connected) subscribe();
    return () => {
      if (orderId) realtimeSocket.emit('unsubscribe:order', { id: orderId });
      realtimeSocket.off('connect', subscribe);
      realtimeSocket.off('order.status.updated', onOrderStatus);
    };
  }, [orderId, sellerOrderId, queryClient]);
}
