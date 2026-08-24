import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import { SellersService } from '../sellers/sellers.service';
import { SellerOrdersService } from './seller-orders.service';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  SellerOrderDetailView,
  SellerOrderListItemView,
} from './dto/seller-order-view';

/**
 * Every handler resolves the caller's SellerProfile from the JWT-derived
 * userId (never a sellerProfileId in the request), then delegates to
 * SellerOrdersService's ownership-scoped queries — mirrors
 * SellerProductsController.
 */
@ApiTags('seller-orders')
@ApiBearerAuth()
@Roles(UserRole.SELLER)
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(
    private readonly sellerOrdersService: SellerOrdersService,
    private readonly sellersService: SellersService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the current seller's own seller orders" })
  async list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: OrderListQueryDto,
  ): Promise<PaginatedResult<SellerOrderListItemView>> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.sellerOrdersService.findMine(profile.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Get one of the current seller's own seller orders",
  })
  async findById(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SellerOrderDetailView> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.sellerOrdersService.findMineById(profile.id, id);
  }
}
