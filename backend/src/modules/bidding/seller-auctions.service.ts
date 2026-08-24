import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { Bid } from './entities/bid.entity';
import { Product } from '../products/entities/product.entity';
import { ProductType } from '../products/entities/product-type.enum';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { AuctionSellerView } from './dto/auction-seller-view';
import { toSellerView } from './domain/auction-view.mapper';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { isUniqueViolation } from '../../common/utils/slug';
import { parseMoneyToCents } from '../../common/utils/money';

/**
 * Seller-owned CRUD for the Auction that belongs to one of the caller's own
 * AUCTION-type Products. Ownership is always resolved through the Product
 * (Auction has no sellerProfileId of its own — see Auction.productId's
 * unique index), and every lookup is scoped to (id, ownerId) so a mismatch
 * reads as 404 — same IDOR defense as SellerProductsController.
 */
@Injectable()
export class SellerAuctionsService {
  private readonly logger = new Logger(SellerAuctionsService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Bid)
    private readonly bidsRepository: Repository<Bid>,
    private readonly outboxService: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly lifecycle: AuctionLifecycleService,
  ) {}

  async findMine(sellerProfileId: string): Promise<AuctionSellerView[]> {
    const auctions = await this.auctionsRepository
      .createQueryBuilder('auction')
      .innerJoinAndSelect('auction.product', 'product')
      .where('product.sellerProfileId = :sellerProfileId', { sellerProfileId })
      .orderBy('auction.createdAt', 'DESC')
      .getMany();

    const counts = await this.bidCounts(auctions.map((a) => a.id));
    return auctions.map((auction) => {
      const count = counts.get(auction.id) ?? 0;
      return toSellerView(auction, count, this.isEditable(auction, count));
    });
  }

  async findMineById(
    id: string,
    sellerProfileId: string,
  ): Promise<AuctionSellerView> {
    const auction = await this.findOwned(id, sellerProfileId);
    const count = await this.bidsRepository.count({ where: { auctionId: id } });
    return toSellerView(auction, count, this.isEditable(auction, count));
  }

  async create(
    sellerProfileId: string,
    dto: CreateAuctionDto,
    correlationId: string,
  ): Promise<AuctionSellerView> {
    const product = await this.productsRepository.findOne({
      where: { id: dto.productId, sellerProfileId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }
    if (product.type !== ProductType.AUCTION) {
      throw new BadRequestException(
        'Only AUCTION-type products can have an auction',
      );
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    if (endsAt.getTime() <= Date.now()) {
      throw new BadRequestException('endsAt must be in the future');
    }
    if (
      parseMoneyToCents(dto.startPrice) <= 0n ||
      parseMoneyToCents(dto.minBidIncrement) <= 0n
    ) {
      throw new BadRequestException(
        'startPrice and minBidIncrement must both be greater than zero',
      );
    }

    let auction: Auction;
    try {
      auction = await this.auctionsRepository.manager.transaction(
        async (manager) => {
          const entity = manager.create(Auction, {
            productId: dto.productId,
            startPrice: dto.startPrice,
            currentPrice: dto.startPrice,
            minBidIncrement: dto.minBidIncrement,
            startsAt,
            endsAt,
            status:
              startsAt.getTime() <= Date.now()
                ? AuctionStatus.ACTIVE
                : AuctionStatus.SCHEDULED,
          });
          const saved = await manager.save(entity);
          await this.outboxService.record(manager, {
            eventType: 'AUCTION_CREATED',
            aggregateType: 'Auction',
            aggregateId: saved.id,
            payload: { auctionId: saved.id, productId: saved.productId },
            correlationId,
          });
          await this.outboxService.record(manager, {
            eventType: 'PRODUCT_UPDATED',
            aggregateType: 'Product',
            aggregateId: product.id,
            payload: { productId: product.id, auctionId: saved.id },
            correlationId,
          });
          return saved;
        },
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This product already has an auction');
      }
      throw error;
    }

    await this.lifecycle.scheduleFinalization(
      auction.id,
      endsAt,
      correlationId,
    );
    await this.cache.invalidateProduct(product.id);
    await this.cache.invalidateSearch();
    this.logger.log(
      `[${correlationId}] auction created auctionId=${auction.id} productId=${product.id} sellerProfileId=${sellerProfileId}`,
    );

    auction.product = product;
    return toSellerView(auction, 0, true);
  }

  async update(
    id: string,
    sellerProfileId: string,
    dto: UpdateAuctionDto,
    correlationId: string,
  ): Promise<AuctionSellerView> {
    const auction = await this.findOwned(id, sellerProfileId);
    const bidCount = await this.bidsRepository.count({
      where: { auctionId: id },
    });
    if (!this.isEditable(auction, bidCount)) {
      throw new ConflictException(
        'This auction can no longer be edited — it already has bids or has ended',
      );
    }

    const nextStartsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : auction.startsAt;
    const nextEndsAt = dto.endsAt ? new Date(dto.endsAt) : auction.endsAt;
    if (nextEndsAt.getTime() <= nextStartsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    const endsAtChanged = nextEndsAt.getTime() !== auction.endsAt.getTime();
    if (
      (dto.startPrice !== undefined &&
        parseMoneyToCents(dto.startPrice) <= 0n) ||
      (dto.minBidIncrement !== undefined &&
        parseMoneyToCents(dto.minBidIncrement) <= 0n)
    ) {
      throw new BadRequestException(
        'startPrice and minBidIncrement must both be greater than zero',
      );
    }

    const updated = await this.auctionsRepository.manager.transaction(
      async (manager) => {
        if (dto.startPrice !== undefined) {
          auction.startPrice = dto.startPrice;
          auction.currentPrice = dto.startPrice;
        }
        if (dto.minBidIncrement !== undefined) {
          auction.minBidIncrement = dto.minBidIncrement;
        }
        auction.startsAt = nextStartsAt;
        auction.endsAt = nextEndsAt;
        auction.status =
          nextStartsAt.getTime() <= Date.now()
            ? AuctionStatus.ACTIVE
            : AuctionStatus.SCHEDULED;

        const saved = await manager.save(auction);
        await this.outboxService.record(manager, {
          eventType: 'AUCTION_UPDATED',
          aggregateType: 'Auction',
          aggregateId: saved.id,
          payload: { auctionId: saved.id },
          correlationId,
        });
        await this.outboxService.record(manager, {
          eventType: 'PRODUCT_UPDATED',
          aggregateType: 'Product',
          aggregateId: saved.productId,
          payload: { productId: saved.productId, auctionId: saved.id },
          correlationId,
        });
        return saved;
      },
    );

    if (endsAtChanged) {
      await this.lifecycle.rescheduleFinalization(
        id,
        nextEndsAt,
        correlationId,
      );
    }
    await this.cache.invalidateProduct(updated.productId);
    await this.cache.invalidateSearch();
    this.logger.log(`[${correlationId}] auction updated auctionId=${id}`);

    return toSellerView(updated, bidCount, true);
  }

  async cancel(
    id: string,
    sellerProfileId: string,
    correlationId: string,
  ): Promise<AuctionSellerView> {
    await this.lifecycle.cancel(
      { type: 'seller', sellerProfileId },
      id,
      correlationId,
    );
    return this.findMineById(id, sellerProfileId);
  }

  private async findOwned(
    id: string,
    sellerProfileId: string,
  ): Promise<Auction> {
    const auction = await this.auctionsRepository
      .createQueryBuilder('auction')
      .innerJoinAndSelect('auction.product', 'product')
      .where('auction.id = :id', { id })
      .andWhere('product.sellerProfileId = :sellerProfileId', {
        sellerProfileId,
      })
      .getOne();
    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }
    return auction;
  }

  private isEditable(auction: Auction, bidCount: number): boolean {
    return (
      bidCount === 0 &&
      (auction.status === AuctionStatus.SCHEDULED ||
        auction.status === AuctionStatus.ACTIVE)
    );
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
