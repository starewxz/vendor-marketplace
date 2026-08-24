import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import { SellersService } from '../sellers/sellers.service';
import { SellerOrdersService } from './seller-orders.service';
import { SellerOrderLifecycleService } from './seller-order-lifecycle.service';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import { UpdateSellerOrderStatusDto } from './dto/update-seller-order-status.dto';
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
    private readonly sellerOrderLifecycleService: SellerOrderLifecycleService,
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

  @Patch(':id/status')
  @ApiOperation({
    summary:
      "Advance one of the current seller's own seller orders (AWAITING_FULFILLMENT -> PROCESSING -> SHIPPED -> DELIVERED)",
  })
  @ApiResponse({ status: 404, description: "Not the caller's seller order." })
  @ApiResponse({
    status: 409,
    description:
      'Requested status is not a valid forward transition from the current status.',
  })
  async updateStatus(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSellerOrderStatusDto,
    @CorrelationId() correlationId: string,
  ): Promise<SellerOrderDetailView> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    await this.sellerOrderLifecycleService.updateStatus(
      { type: 'seller', sellerProfileId: profile.id },
      id,
      dto.status,
      correlationId,
    );
    return this.sellerOrdersService.findMineById(profile.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      "Cancel one of the current seller's own seller orders (only from AWAITING_FULFILLMENT or PROCESSING) — restores stock and reverses the ledger",
  })
  @ApiResponse({ status: 404, description: "Not the caller's seller order." })
  @ApiResponse({
    status: 409,
    description:
      'The seller order is past the cancellable window (already SHIPPED/DELIVERED).',
  })
  async cancel(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<SellerOrderDetailView> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    await this.sellerOrderLifecycleService.cancel(
      { type: 'seller', sellerProfileId: profile.id },
      id,
      correlationId,
    );
    return this.sellerOrdersService.findMineById(profile.id, id);
  }
}
