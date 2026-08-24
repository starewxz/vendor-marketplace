import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  CustomerOrderDetailView,
  CustomerOrderListItemView,
} from './dto/customer-order-view';

const DETAIL_RELATIONS = {
  sellerOrders: { items: true, sellerProfile: true },
} as const;

/**
 * Every read here is scoped by (id, buyerId) together, never id alone — a
 * mismatched buyerId reads as "not found", not "forbidden", so a customer
 * probing another customer's order id can't even confirm it exists. See
 * README "Ownership".
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async findMine(
    buyerId: string,
    query: OrderListQueryDto,
  ): Promise<PaginatedResult<CustomerOrderListItemView>> {
    const [orders, total] = await this.ordersRepository.findAndCount({
      where: { buyerId },
      relations: { sellerOrders: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      items: orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        sellerCount: order.sellerOrders.length,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findMineById(
    buyerId: string,
    id: string,
  ): Promise<CustomerOrderDetailView> {
    const order = await this.ordersRepository.findOne({
      where: { id, buyerId },
      relations: DETAIL_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      shippingAddressLine1: order.shippingAddressLine1,
      shippingAddressLine2: order.shippingAddressLine2,
      shippingCity: order.shippingCity,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      sellerOrders: order.sellerOrders.map((sellerOrder) => ({
        id: sellerOrder.id,
        storeName: sellerOrder.sellerProfile.storeName,
        status: sellerOrder.status,
        subtotal: sellerOrder.subtotal,
        items: sellerOrder.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      })),
    };
  }
}
