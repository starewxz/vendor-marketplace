import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerOrder } from './entities/seller-order.entity';
import { AdminSellerOrderView } from './dto/admin-order-view';
import { buildSellerOrderDetailView } from './seller-orders.service';

const DETAIL_RELATIONS = {
  items: true,
  order: true,
  refunds: true,
  sellerProfile: true,
} as const;

/** Unscoped reads/writes — full financial visibility, any seller's order. */
@Injectable()
export class AdminSellerOrdersService {
  constructor(
    @InjectRepository(SellerOrder)
    private readonly sellerOrdersRepository: Repository<SellerOrder>,
  ) {}

  async findById(id: string): Promise<AdminSellerOrderView> {
    const sellerOrder = await this.sellerOrdersRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!sellerOrder) {
      throw new NotFoundException(`Seller order ${id} not found`);
    }

    const base = buildSellerOrderDetailView(sellerOrder);
    return {
      id: base.id,
      sellerProfileId: sellerOrder.sellerProfileId,
      storeName: sellerOrder.sellerProfile.storeName,
      status: base.status,
      subtotal: base.subtotal,
      commissionAmount: base.commissionAmount,
      sellerNetAmount: base.sellerNetAmount,
      financials: base.financials,
      items: base.items,
      refunds: base.refunds,
    };
  }
}
