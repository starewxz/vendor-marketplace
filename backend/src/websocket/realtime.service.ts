import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { MetricsRegistryService } from '../modules/metrics/metrics-registry.service';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  constructor(private readonly metrics: MetricsRegistryService) {}

  bindServer(server: Server): void {
    this.server = server;
  }

  emitToRooms(
    rooms: string[],
    eventType: string,
    payload: Record<string, unknown>,
    meta: { correlationId: string; eventId: string },
  ): void {
    if (!this.server) {
      throw new Error('Realtime gateway is not initialized');
    }
    try {
      const uniqueRooms = [...new Set(rooms)];
      let target = this.server.to(uniqueRooms[0]);
      for (const room of uniqueRooms.slice(1)) target = target.to(room);
      target.emit(eventType, payload);
      this.metrics.increment('websocket_events_emitted_total');
      this.logger.log(
        `[${meta.correlationId}] realtime emitted eventId=${meta.eventId} eventType=${eventType} rooms=${uniqueRooms.join(',')}`,
      );
    } catch (error) {
      this.metrics.increment('websocket_errors_total');
      this.logger.error(
        `[${meta.correlationId}] realtime broadcast failed eventId=${meta.eventId} eventType=${eventType}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
