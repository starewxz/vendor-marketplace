import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BiddingService } from './bidding.service';
import { AuctionPublicView } from './dto/auction-public-view';

@ApiTags('bidding')
@Controller('products')
export class ProductAuctionsController {
  constructor(private readonly biddingService: BiddingService) {}

  @Public()
  @Get(':productId/auction')
  @ApiOperation({ summary: "Get a product's public auction configuration" })
  findByProductId(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<AuctionPublicView> {
    return this.biddingService.findByProductId(productId);
  }
}
