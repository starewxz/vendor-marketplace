import { createContext } from 'react';
import type { RealtimeConnectionStatus } from './types';

export interface RealtimeContextValue {
  status: RealtimeConnectionStatus;
}

export const RealtimeContext = createContext<RealtimeContextValue>({
  status: 'offline',
});
