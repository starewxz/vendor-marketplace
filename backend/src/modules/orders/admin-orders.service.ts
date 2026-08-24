import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  AdminOrderDetailView,
  AdminOrderListItemView,
} from './dto/admin-order-view';

const DETAIL_RELATIONS = {
  sellerOrders: { items: true, sellerProfile: true },
} as const;

/** Unscoped reads — full financial visibility across every order. */
@Injectable()
export class AdminOrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async findAll(
    query: OrderListQueryDto,
  ): Promise<PaginatedResult<AdminOrderListItemView>> {
    const [orders, total] = await this.ordersRepository.findAndCount({
      relations: { sellerOrders: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      items: orders.map((order) => ({
        id: order.id,
        buyerId: order.buyerId,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        sellerOrderCount: order.sellerOrders.length,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string): Promise<AdminOrderDetailView> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return {
      id: order.id,
      buyerId: order.buyerId,
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
        sellerProfileId: sellerOrder.sellerProfileId,
        storeName: sellerOrder.sellerProfile.storeName,
        status: sellerOrder.status,
        subtotal: sellerOrder.subtotal,
        commissionAmount: sellerOrder.commissionAmount,
        sellerNetAmount: sellerOrder.sellerNetAmount,
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
