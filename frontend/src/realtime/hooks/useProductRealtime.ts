import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProductDetail } from '../../types/product';
import { realtimeSocket } from '../socket';
import type { ProductStockUpdatedEvent } from '../types';

export function useProductRealtime(productId?: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!productId) return;
    const subscribe = () =>
      realtimeSocket.emit('subscribe:product', { id: productId });
    const onStock = (event: ProductStockUpdatedEvent) => {
      if (event.productId !== productId) return;
      queryClient.setQueryData<ProductDetail>(
        ['products', productId],
        (current) => {
          if (!current) return current;
          if (new Date(current.updatedAt).getTime() > new Date(event.updatedAt).getTime()) {
            return current;
          }
          return { ...current, stockQuantity: event.stock, updatedAt: event.updatedAt };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    };

    realtimeSocket.on('connect', subscribe);
    realtimeSocket.on('product.stock.updated', onStock);
    if (realtimeSocket.connected) subscribe();
    return () => {
      realtimeSocket.emit('unsubscribe:product', { id: productId });
      realtimeSocket.off('connect', subscribe);
      realtimeSocket.off('product.stock.updated', onStock);
    };
  }, [productId, queryClient]);
}
