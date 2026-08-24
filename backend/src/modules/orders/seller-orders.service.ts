import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerOrder } from './entities/seller-order.entity';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  SellerOrderDetailView,
  SellerOrderListItemView,
} from './dto/seller-order-view';

/**
 * Every read here is scoped by (id, sellerProfileId) together — a seller
 * can never see another seller's slice of a shared multi-vendor order,
 * and a mismatched id reads as "not found". See README "Ownership".
 */
@Injectable()
export class SellerOrdersService {
  constructor(
    @InjectRepository(SellerOrder)
    private readonly sellerOrdersRepository: Repository<SellerOrder>,
  ) {}

  async findMine(
    sellerProfileId: string,
    query: OrderListQueryDto,
  ): Promise<PaginatedResult<SellerOrderListItemView>> {
    const [sellerOrders, total] =
      await this.sellerOrdersRepository.findAndCount({
        where: { sellerProfileId },
        relations: { items: true },
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });

    return {
      items: sellerOrders.map((sellerOrder) => ({
        id: sellerOrder.id,
        orderId: sellerOrder.orderId,
        status: sellerOrder.status,
        subtotal: sellerOrder.subtotal,
        commissionAmount: sellerOrder.commissionAmount,
        sellerNetAmount: sellerOrder.sellerNetAmount,
        createdAt: sellerOrder.createdAt,
        itemCount: sellerOrder.items.length,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findMineById(
    sellerProfileId: string,
    id: string,
  ): Promise<SellerOrderDetailView> {
    const sellerOrder = await this.sellerOrdersRepository.findOne({
      where: { id, sellerProfileId },
      relations: { items: true, order: true },
    });
    if (!sellerOrder) {
      throw new NotFoundException(`Seller order ${id} not found`);
    }

    return {
      id: sellerOrder.id,
      orderId: sellerOrder.orderId,
      status: sellerOrder.status,
      subtotal: sellerOrder.subtotal,
      commissionAmount: sellerOrder.commissionAmount,
      sellerNetAmount: sellerOrder.sellerNetAmount,
      createdAt: sellerOrder.createdAt,
      items: sellerOrder.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      shippingAddressLine1: sellerOrder.order.shippingAddressLine1,
      shippingAddressLine2: sellerOrder.order.shippingAddressLine2,
      shippingCity: sellerOrder.order.shippingCity,
      shippingPostalCode: sellerOrder.order.shippingPostalCode,
      shippingCountry: sellerOrder.order.shippingCountry,
    };
  }
}
