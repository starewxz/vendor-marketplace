import { Injectable, Logger } from '@nestjs/common';

/**
 * Delivery channel abstraction for Stage 5+ (email, in-app, WebSocket push).
 * Consumes outbox events the same way search-sync does — no direct calls
 * from domain services.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  notify(userId: string, message: string): void {
    this.logger.debug(`Notification for ${userId}: ${message}`);
  }
}
