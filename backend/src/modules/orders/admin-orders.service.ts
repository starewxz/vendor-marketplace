import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { RefundStatus } from '../refunds/entities/refund-status.enum';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  AdminOrderDetailView,
  AdminOrderListItemView,
} from './dto/admin-order-view';
import {
  deriveOrderFinancialSummary,
  deriveSellerOrderFinancialSummary,
} from './domain/financial-summary';
import { refundedQuantityByItem } from './seller-orders.service';

const DETAIL_RELATIONS = {
  sellerOrders: { items: true, sellerProfile: true, refunds: true },
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

    const sellerOrderSummaries = order.sellerOrders.map((sellerOrder) => {
      const completedRefunds = sellerOrder.refunds.filter(
        (r) => r.status === RefundStatus.COMPLETED,
      );
      return {
        sellerOrder,
        completedRefunds,
        financials: deriveSellerOrderFinancialSummary(
          sellerOrder,
          completedRefunds,
        ),
      };
    });

    const orderFinancials = deriveOrderFinancialSummary(
      order.totalAmount,
      sellerOrderSummaries.map((s) => s.financials),
    );

    return {
      id: order.id,
      buyerId: order.buyerId,
      status: order.status,
      originalTotal: orderFinancials.originalTotal,
      refundedTotal: orderFinancials.refundedTotal,
      effectiveTotal: orderFinancials.effectiveTotal,
      createdAt: order.createdAt,
      shippingAddressLine1: order.shippingAddressLine1,
      shippingAddressLine2: order.shippingAddressLine2,
      shippingCity: order.shippingCity,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      sellerOrders: sellerOrderSummaries.map(
        ({ sellerOrder, completedRefunds, financials }) => {
          const refundedQtyByItem = refundedQuantityByItem(completedRefunds);
          return {
            id: sellerOrder.id,
            sellerProfileId: sellerOrder.sellerProfileId,
            storeName: sellerOrder.sellerProfile.storeName,
            status: sellerOrder.status,
            subtotal: sellerOrder.subtotal,
            commissionAmount: sellerOrder.commissionAmount,
            sellerNetAmount: sellerOrder.sellerNetAmount,
            financials,
            items: sellerOrder.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
              refundedQuantity: refundedQtyByItem.get(item.id) ?? 0,
            })),
            refunds: completedRefunds.map((r) => ({
              id: r.id,
              sellerOrderItemId: r.sellerOrderItemId,
              quantity: r.quantity,
              amount: r.amount,
              commissionAdjustment: r.commissionAdjustment,
              sellerAdjustment: r.sellerAdjustment,
              reason: r.reason,
              status: r.status,
              createdAt: r.createdAt,
            })),
          };
        },
      ),
    };
  }
}
