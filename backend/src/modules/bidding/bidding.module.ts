import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { Product } from '../products/entities/product.entity';
import { BiddingService } from './bidding.service';
import { BiddingController } from './bidding.controller';
import { BidPlacementService } from './bid-placement.service';
import { AuctionCheckoutService } from './auction-checkout.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { AuctionFinalizationProcessor } from './auction-finalization.processor';
import { AuctionReconciliationService } from './auction-reconciliation.service';
import { SellerAuctionsService } from './seller-auctions.service';
import { SellerAuctionsController } from './seller-auctions.controller';
import { AdminAuctionsService } from './admin-auctions.service';
import { AdminAuctionsController } from './admin-auctions.controller';
import { ProductAuctionsController } from './product-auctions.controller';
import { SellersModule } from '../sellers/sellers.module';
import { OutboxModule } from '../outbox/outbox.module';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Auction, Bid, Product]),
    BullModule.registerQueue({ name: QUEUE_NAMES.AUCTION_FINALIZATION }),
    SellersModule,
    OutboxModule,
  ],
  controllers: [
    BiddingController,
    SellerAuctionsController,
    AdminAuctionsController,
    ProductAuctionsController,
  ],
  providers: [
    BiddingService,
    BidPlacementService,
    AuctionCheckoutService,
    AuctionLifecycleService,
    AuctionFinalizationProcessor,
    AuctionReconciliationService,
    SellerAuctionsService,
    AdminAuctionsService,
  ],
  exports: [BiddingService],
})
export class BiddingModule {}
