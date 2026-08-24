import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { MetricsRegistryService } from '../modules/metrics/metrics-registry.service';
import { RealtimeService } from './realtime.service';
import { RealtimeSubscriptionService } from './realtime-subscription.service';
import { SocketAuthService } from './socket-auth.service';
import {
  auctionRoom,
  orderRoom,
  productRoom,
  sellerRoom,
  userRoom,
} from './realtime.types';
import type {
  RealtimeSocketData,
  SubscriptionRequest,
  SubscriptionResult,
} from './realtime.types';

type RealtimeSocket = Socket<never, never, never, RealtimeSocketData>;

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AppGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly auth: SocketAuthService,
    private readonly subscriptions: RealtimeSubscriptionService,
    private readonly realtime: RealtimeService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.bindServer(server);
    server.use((socket: RealtimeSocket, next) => {
      socket.data.correlationId = randomUUID();
      void this.auth
        .authenticate(socket)
        .then((identity) => {
          socket.data.identity = identity;
          next();
        })
        .catch((error: Error) => {
          this.metrics.increment('websocket_errors_total');
          this.logger.warn(
            `[${socket.data.correlationId}] socket authentication failed socketId=${socket.id}: ${error.message}`,
          );
          next(new Error('Unauthorized'));
        });
    });
  }

  async handleConnection(client: RealtimeSocket): Promise<void> {
    const identity = client.data.identity;
    if (identity) {
      await client.join(userRoom(identity.userId));
      if (identity.sellerProfileId) {
        await client.join(sellerRoom(identity.sellerProfileId));
      }
    }
    this.metrics.increment('websocket_connections_total');
    this.metrics.incrementGauge('websocket_connections_current');
    this.logger.log(
      `[${client.data.correlationId}] socket connected socketId=${client.id} userId=${identity?.userId ?? 'public'} role=${identity?.role ?? 'PUBLIC'}`,
    );
  }

  handleDisconnect(client: RealtimeSocket): void {
    this.metrics.increment('websocket_disconnects_total');
    this.metrics.incrementGauge('websocket_connections_current', -1);
    this.logger.log(
      `[${client.data.correlationId ?? 'unknown'}] socket disconnected socketId=${client.id} userId=${client.data.identity?.userId ?? 'public'}`,
    );
  }

  @SubscribeMessage('subscribe:product')
  async subscribeProduct(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() request: SubscriptionRequest,
  ): Promise<SubscriptionResult> {
    return this.logSubscription(
      socket,
      'subscribe:product',
      this.subscriptions.subscribeProduct(socket, request?.id),
    );
  }

  @SubscribeMessage('unsubscribe:product')
  async unsubscribeProduct(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() request: SubscriptionRequest,
  ): Promise<SubscriptionResult> {
    return this.leave(socket, productRoom(request?.id));
  }

  @SubscribeMessage('subscribe:auction')
  async subscribeAuction(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() request: SubscriptionRequest,
  ): Promise<SubscriptionResult> {
    return this.logSubscription(
      socket,
      'subscribe:auction',
      this.subscriptions.subscribeAuction(socket, request?.id),
    );
  }

  @SubscribeMessage('unsubscribe:auction')
  async unsubscribeAuction(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() request: SubscriptionRequest,
  ): Promise<SubscriptionResult> {
    return this.leave(socket, auctionRoom(request?.id));
  }

  @SubscribeMessage('subscribe:order')
  async subscribeOrder(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() request: SubscriptionRequest,
  ): Promise<SubscriptionResult> {
    return this.logSubscription(
      socket,
      'subscribe:order',
      this.subscriptions.subscribeOrder(socket, request?.id),
    );
  }

  @SubscribeMessage('unsubscribe:order')
  async unsubscribeOrder(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() request: SubscriptionRequest,
  ): Promise<SubscriptionResult> {
    return this.leave(socket, orderRoom(request?.id));
  }

  private async logSubscription(
    socket: RealtimeSocket,
    operation: string,
    resultPromise: Promise<SubscriptionResult>,
  ): Promise<SubscriptionResult> {
    const result = await resultPromise;
    if (!result.ok) {
      this.metrics.increment('websocket_errors_total');
      this.logger.warn(
        `[${socket.data.correlationId}] room subscription failed socketId=${socket.id} operation=${operation} error=${result.error}`,
      );
    } else {
      this.logger.log(
        `[${socket.data.correlationId}] room subscribed socketId=${socket.id} room=${result.room}`,
      );
    }
    return result;
  }

  private async leave(
    socket: RealtimeSocket,
    room: string,
  ): Promise<SubscriptionResult> {
    await this.subscriptions.unsubscribe(socket, room);
    return { ok: true, room };
  }
}
