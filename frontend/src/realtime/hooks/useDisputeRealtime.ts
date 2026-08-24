import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeSocket } from '../socket';

export function useDisputeRealtime(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['disputes'] });
    realtimeSocket.on('dispute.opened', refresh); realtimeSocket.on('dispute.updated', refresh); realtimeSocket.on('dispute.resolved', refresh);
    return () => { realtimeSocket.off('dispute.opened', refresh); realtimeSocket.off('dispute.updated', refresh); realtimeSocket.off('dispute.resolved', refresh); };
  }, [queryClient]);
}
