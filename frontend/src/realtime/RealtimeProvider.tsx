import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../features/auth/useAuth';
import { subscribeAccessToken } from '../features/auth/token-storage';
import { RealtimeContext } from './realtime-context';
import {
  connectRealtimeSocket,
  realtimeSocket,
  reconnectRealtimeSocket,
} from './socket';
import { resyncAuthoritativeState } from './resync';
import type { RealtimeConnectionStatus } from './types';

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, isInitializing } = useAuth();
  const [status, setStatus] = useState<RealtimeConnectionStatus>('offline');
  const hasConnected = useRef(false);
  const roleRef = useRef(user?.role);

  useEffect(() => {
    roleRef.current = user?.role;
  }, [user?.role]);

  useEffect(() => {
    const onConnect = () => {
      setStatus('live');
      if (hasConnected.current) {
        void resyncAuthoritativeState(queryClient, roleRef.current);
      }
      hasConnected.current = true;
    };
    const onDisconnect = (reason: string) => {
      setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting');
    };
    const onConnectError = () => setStatus('offline');
    const onReconnectAttempt = () => setStatus('reconnecting');

    realtimeSocket.on('connect', onConnect);
    realtimeSocket.on('disconnect', onDisconnect);
    realtimeSocket.on('connect_error', onConnectError);
    realtimeSocket.io.on('reconnect_attempt', onReconnectAttempt);
    const unsubscribeToken = subscribeAccessToken(() => {
      setStatus('connecting');
      reconnectRealtimeSocket();
    });

    return () => {
      unsubscribeToken();
      realtimeSocket.off('connect', onConnect);
      realtimeSocket.off('disconnect', onDisconnect);
      realtimeSocket.off('connect_error', onConnectError);
      realtimeSocket.io.off('reconnect_attempt', onReconnectAttempt);
      realtimeSocket.disconnect();
      hasConnected.current = false;
    };
  }, [queryClient]);

  useEffect(() => {
    if (isInitializing || realtimeSocket.active || realtimeSocket.connected) return;
    connectRealtimeSocket();
  }, [isInitializing]);

  const value = useMemo(() => ({ status }), [status]);
  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
