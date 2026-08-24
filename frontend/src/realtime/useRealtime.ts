import { useContext } from 'react';
import { RealtimeContext } from './realtime-context';

export function useRealtime() {
  return useContext(RealtimeContext);
}
