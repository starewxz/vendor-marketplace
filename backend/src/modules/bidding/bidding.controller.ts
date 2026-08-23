import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BiddingService } from './bidding.service';
import { Auction } from './entities/auction.entity';

@ApiTags('bidding')
@Controller('auctions')
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Auction> {
    return this.biddingService.findById(id);
  }
}
