import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { AuctionPublicView } from './dto/auction-public-view';
import { AuctionWinnerStateView } from './dto/auction-public-view';
import { AuctionStatus } from './entities/auction-status.enum';
import { BidHistoryItemView } from './dto/bid-history-item-view';
import { toPublicView } from './domain/auction-view.mapper';
import { anonymizeBidHistory } from './domain/bid-anonymization';

const BID_HISTORY_LIMIT = 100;

/** Public, unauthenticated-safe reads only — see AuctionPublicView and
 * anonymizeBidHistory for what's deliberately excluded (bidder identity). */
@Injectable()
export class BiddingService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidsRepository: Repository<Bid>,
  ) {}

  async findById(id: string): Promise<AuctionPublicView> {
    const auction = await this.auctionsRepository.findOne({
      where: { id },
      relations: { product: true },
    });
    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }
    const bidCount = await this.bidsRepository.count({
      where: { auctionId: id },
    });
    return toPublicView(auction, bidCount);
  }

  async findByProductId(productId: string): Promise<AuctionPublicView> {
    const auction = await this.auctionsRepository.findOne({
      where: { productId },
      relations: { product: true },
    });
    if (!auction) {
      throw new NotFoundException(`Auction for product ${productId} not found`);
    }
    const bidCount = await this.bidsRepository.count({
      where: { auctionId: auction.id },
    });
    return toPublicView(auction, bidCount);
  }

  async winnerState(
    auctionId: string,
    userId: string,
  ): Promise<AuctionWinnerStateView> {
    const auction = await this.auctionsRepository.findOne({
      where: { id: auctionId },
    });
    if (!auction) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }
    const isWinner = auction.winnerId === userId;
    return {
      isWinner,
      canCheckout:
        isWinner &&
        auction.status === AuctionStatus.AWAITING_PAYMENT &&
        !!auction.purchaseWindowEndsAt &&
        auction.purchaseWindowEndsAt.getTime() > Date.now(),
      purchaseWindowEndsAt: isWinner ? auction.purchaseWindowEndsAt : null,
    };
  }

  async findBidHistory(
    auctionId: string,
    currentUserId: string | undefined,
  ): Promise<BidHistoryItemView[]> {
    const exists = await this.auctionsRepository.exists({
      where: { id: auctionId },
    });
    if (!exists) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }

    // Oldest-first across the *whole* history so anonymizeBidHistory's
    // "Bidder N" labels are assigned by true first-appearance order, even
    // though only the most recent BID_HISTORY_LIMIT are returned — capping
    // before anonymizing would let an early bidder get relabeled once
    // their first bid ages out of the window.
    const bids = await this.bidsRepository.find({
      where: { auctionId },
      order: { createdAt: 'ASC' },
    });

    const anonymized = anonymizeBidHistory(bids, currentUserId);
    return anonymized.slice(-BID_HISTORY_LIMIT).reverse();
  }
}
