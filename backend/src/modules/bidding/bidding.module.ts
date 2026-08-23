import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { BiddingService } from './bidding.service';
import { BiddingController } from './bidding.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Auction, Bid])],
  controllers: [BiddingController],
  providers: [BiddingService],
  exports: [BiddingService],
})
export class BiddingModule {}
