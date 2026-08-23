import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Minimal gateway foundation. Room-per-entity events (product:{id},
 * auction:{id}, customer:{userId}, seller:{sellerId}) and authenticated
 * socket handshakes (JWT verification, join-room handlers) are added once
 * auth exists in Stage 2+ — wiring them now against a stub auth layer would
 * need to be redone.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AppGateway.name);

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }
}
