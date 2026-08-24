import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { AdminAuctionsService } from './admin-auctions.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import {
  OrderListQueryDto,
  PaginatedResult,
} from '../orders/dto/order-list-query.dto';
import { AuctionSellerView } from './dto/auction-seller-view';

@ApiTags('admin-auctions')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/auctions')
export class AdminAuctionsController {
  constructor(
    private readonly adminAuctionsService: AdminAuctionsService,
    private readonly lifecycle: AuctionLifecycleService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List every auction, with full visibility' })
  findAll(
    @Query() query: OrderListQueryDto,
  ): Promise<PaginatedResult<AuctionSellerView>> {
    return this.adminAuctionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any auction, with full visibility' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<AuctionSellerView> {
    return this.adminAuctionsService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel any auction (only before a winner is determined)',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<AuctionSellerView> {
    await this.lifecycle.cancel({ type: 'admin' }, id, correlationId);
    return this.adminAuctionsService.findById(id);
  }
}
