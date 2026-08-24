import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import {
  OrderListQueryDto,
  PaginatedResult,
} from '../orders/dto/order-list-query.dto';
import { AuctionSellerView } from './dto/auction-seller-view';
import { toSellerView } from './domain/auction-view.mapper';

/**
 * Unscoped reads across every auction, reusing AuctionSellerView (an admin
 * gets at least as much visibility as the owning seller — winnerId +
 * editability — never less). Mutation is limited to cancel, which goes
 * through the exact same AuctionLifecycleService the seller endpoint uses
 * with an unscoped actor — admin privileges widen who can act, never what
 * transitions are valid (see orders/seller-order-lifecycle.service.ts for
 * the same pattern).
 */
@Injectable()
export class AdminAuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidsRepository: Repository<Bid>,
  ) {}

  async findAll(
    query: OrderListQueryDto,
  ): Promise<PaginatedResult<AuctionSellerView>> {
    const [auctions, total] = await this.auctionsRepository.findAndCount({
      relations: { product: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    const counts = await this.bidCounts(auctions.map((a) => a.id));
    return {
      items: auctions.map((auction) => {
        const count = counts.get(auction.id) ?? 0;
        return toSellerView(auction, count, count === 0);
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string): Promise<AuctionSellerView> {
    const auction = await this.auctionsRepository.findOne({
      where: { id },
      relations: { product: true },
    });
    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }
    const count = await this.bidsRepository.count({ where: { auctionId: id } });
    return toSellerView(auction, count, count === 0);
  }

  private async bidCounts(auctionIds: string[]): Promise<Map<string, number>> {
    if (auctionIds.length === 0) return new Map();
    const rows = await this.bidsRepository
      .createQueryBuilder('bid')
      .select('bid.auctionId', 'auctionId')
      .addSelect('COUNT(*)', 'count')
      .where('bid.auctionId IN (:...ids)', { ids: auctionIds })
      .groupBy('bid.auctionId')
      .getRawMany<{ auctionId: string; count: string }>();
    return new Map(rows.map((r) => [r.auctionId, Number(r.count)]));
  }
}
