import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerOrder } from './entities/seller-order.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { RefundStatus } from '../refunds/entities/refund-status.enum';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  SellerOrderDetailView,
  SellerOrderItemView,
  SellerOrderListItemView,
  SellerOrderRefundView,
} from './dto/seller-order-view';
import { deriveSellerOrderFinancialSummary } from './domain/financial-summary';

const DETAIL_RELATIONS = { items: true, order: true, refunds: true } as const;

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
      relations: DETAIL_RELATIONS,
    });
    if (!sellerOrder) {
      throw new NotFoundException(`Seller order ${id} not found`);
    }
    return buildSellerOrderDetailView(sellerOrder);
  }
}

/** Shared by SellerOrdersService and AdminSellerOrdersService — both build
 * the same underlying view, admin's controller just adds a storeName. */
export function buildSellerOrderDetailView(
  sellerOrder: SellerOrder,
): SellerOrderDetailView {
  const completedRefunds = sellerOrder.refunds.filter(
    (r) => r.status === RefundStatus.COMPLETED,
  );
  const refundedQtyByItem = refundedQuantityByItem(completedRefunds);

  const items: SellerOrderItemView[] = sellerOrder.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    refundedQuantity: refundedQtyByItem.get(item.id) ?? 0,
  }));

  const refunds: SellerOrderRefundView[] = completedRefunds.map((r) => ({
    id: r.id,
    sellerOrderItemId: r.sellerOrderItemId,
    quantity: r.quantity,
    amount: r.amount,
    commissionAdjustment: r.commissionAdjustment,
    sellerAdjustment: r.sellerAdjustment,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt,
  }));

  return {
    id: sellerOrder.id,
    orderId: sellerOrder.orderId,
    status: sellerOrder.status,
    subtotal: sellerOrder.subtotal,
    commissionAmount: sellerOrder.commissionAmount,
    sellerNetAmount: sellerOrder.sellerNetAmount,
    financials: deriveSellerOrderFinancialSummary(
      sellerOrder,
      completedRefunds,
    ),
    createdAt: sellerOrder.createdAt,
    items,
    refunds,
    shippingAddressLine1: sellerOrder.order.shippingAddressLine1,
    shippingAddressLine2: sellerOrder.order.shippingAddressLine2,
    shippingCity: sellerOrder.order.shippingCity,
    shippingPostalCode: sellerOrder.order.shippingPostalCode,
    shippingCountry: sellerOrder.order.shippingCountry,
  };
}

export function refundedQuantityByItem(
  completedRefunds: Refund[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const refund of completedRefunds) {
    map.set(
      refund.sellerOrderItemId,
      (map.get(refund.sellerOrderItemId) ?? 0) + refund.quantity,
    );
  }
  return map;
}
