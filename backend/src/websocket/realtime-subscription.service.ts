import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { Auction } from '../modules/bidding/entities/auction.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { Product } from '../modules/products/entities/product.entity';
import { UserRole } from '../modules/users/entities/user-role.enum';
import {
  auctionRoom,
  orderRoom,
  productRoom,
  RealtimeSocketData,
  SubscriptionResult,
} from './realtime.types';

type RealtimeSocket = Socket<never, never, never, RealtimeSocketData>;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

@Injectable()
export class RealtimeSubscriptionService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Auction)
    private readonly auctions: Repository<Auction>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
  ) {}

  async subscribeProduct(
    socket: RealtimeSocket,
    id: string,
  ): Promise<SubscriptionResult> {
    if (!isUuid(id)) return { ok: false, error: 'Invalid product id' };
    if (!(await this.products.exists({ where: { id, isPublished: true } }))) {
      return { ok: false, error: 'Product not found' };
    }
    return this.join(socket, productRoom(id));
  }

  async subscribeAuction(
    socket: RealtimeSocket,
    id: string,
  ): Promise<SubscriptionResult> {
    if (!isUuid(id)) return { ok: false, error: 'Invalid auction id' };
    if (!(await this.auctions.exists({ where: { id } }))) {
      return { ok: false, error: 'Auction not found' };
    }
    return this.join(socket, auctionRoom(id));
  }

  async subscribeOrder(
    socket: RealtimeSocket,
    id: string,
  ): Promise<SubscriptionResult> {
    const identity = socket.data.identity;
    if (!identity) return { ok: false, error: 'Authentication required' };
    if (!isUuid(id)) return { ok: false, error: 'Invalid order id' };

    const where =
      identity.role === UserRole.ADMIN
        ? { id }
        : { id, buyerId: identity.userId };
    if (!(await this.orders.exists({ where }))) {
      return { ok: false, error: 'Order not found' };
    }
    const room = orderRoom(id);
    await socket.join(room);
    return { ok: true, room };
  }

  async unsubscribe(socket: RealtimeSocket, room: string): Promise<void> {
    await socket.leave(room);
  }

  private async join(
    socket: RealtimeSocket,
    room: string,
  ): Promise<SubscriptionResult> {
    await socket.join(room);
    return { ok: true, room };
  }
}
