import { io } from 'socket.io-client';
import { env } from '../config/env';
import { getAccessToken } from '../features/auth/token-storage';

export const realtimeSocket = io(env.socketUrl, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
  randomizationFactor: 0.4,
});

export function connectRealtimeSocket(): void {
  realtimeSocket.auth = { token: getAccessToken() };
  if (!realtimeSocket.connected) realtimeSocket.connect();
}

export function reconnectRealtimeSocket(): void {
  realtimeSocket.auth = { token: getAccessToken() };
  if (realtimeSocket.connected) realtimeSocket.disconnect();
  realtimeSocket.connect();
}
