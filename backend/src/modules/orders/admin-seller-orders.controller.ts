import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { AdminSellerOrdersService } from './admin-seller-orders.service';
import { SellerOrderLifecycleService } from './seller-order-lifecycle.service';
import { UpdateSellerOrderStatusDto } from './dto/update-seller-order-status.dto';
import { AdminSellerOrderView } from './dto/admin-order-view';

/**
 * Admin can inspect/update any SellerOrder, but transitions/cancellation
 * go through the exact same SellerOrderLifecycleService and domain policy
 * as the seller-facing endpoints — admin privileges widen *who* can act,
 * never *what* transitions are valid. See domain/seller-order-status.policy.
 */
@ApiTags('admin-seller-orders')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/seller-orders')
export class AdminSellerOrdersController {
  constructor(
    private readonly adminSellerOrdersService: AdminSellerOrdersService,
    private readonly sellerOrderLifecycleService: SellerOrderLifecycleService,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get any seller order, with full financial visibility',
  })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminSellerOrderView> {
    return this.adminSellerOrdersService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Advance any seller order (same forward-only transition rules as the seller-facing endpoint)',
  })
  @ApiResponse({ status: 404, description: 'Seller order not found.' })
  @ApiResponse({
    status: 409,
    description:
      'Requested status is not a valid forward transition from the current status.',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSellerOrderStatusDto,
    @CorrelationId() correlationId: string,
  ): Promise<AdminSellerOrderView> {
    await this.sellerOrderLifecycleService.updateStatus(
      { type: 'admin' },
      id,
      dto.status,
      correlationId,
    );
    return this.adminSellerOrdersService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      'Cancel any seller order (only from AWAITING_FULFILLMENT or PROCESSING) — restores stock and reverses the ledger',
  })
  @ApiResponse({ status: 404, description: 'Seller order not found.' })
  @ApiResponse({
    status: 409,
    description:
      'The seller order is past the cancellable window (already SHIPPED/DELIVERED).',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<AdminSellerOrderView> {
    await this.sellerOrderLifecycleService.cancel(
      { type: 'admin' },
      id,
      correlationId,
    );
    return this.adminSellerOrdersService.findById(id);
  }
}
