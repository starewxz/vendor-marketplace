import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { IdempotencyKeyHeader } from '../../common/decorators/idempotency-key.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundView } from './dto/refund-view';

/**
 * Admin-only by design (see README "Cancellation vs refund") — a customer
 * or seller cannot self-serve a financial refund in this stage. The refund
 * amount is always computed server-side from the SellerOrderItem's
 * purchase snapshot; nothing financial is accepted from the request body.
 */
@ApiTags('admin-refunds')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/seller-orders/:sellerOrderId/refunds')
export class AdminRefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated unique key, scoped to this seller order. Retrying the same key returns the original refund instead of creating a duplicate.',
  })
  @ApiOperation({
    summary:
      'Create a partial refund for one item on a seller order — amount/commission/seller corrections are computed server-side',
  })
  @ApiResponse({ status: 201, type: RefundView })
  @ApiResponse({
    status: 400,
    description: 'Missing/invalid Idempotency-Key header.',
  })
  @ApiResponse({
    status: 404,
    description: 'Seller order not found, or the item does not belong to it.',
  })
  @ApiResponse({
    status: 409,
    description:
      'The seller order is not eligible for a refund, or the requested quantity exceeds what remains refundable.',
  })
  create(
    @Param('sellerOrderId', ParseUUIDPipe) sellerOrderId: string,
    @Body() dto: CreateRefundDto,
    @IdempotencyKeyHeader() idempotencyKey: string | undefined,
    @CurrentUser() admin: AuthenticatedRequestUser,
    @CorrelationId() correlationId: string,
  ): Promise<RefundView> {
    return this.refundsService.createRefund(
      sellerOrderId,
      dto,
      idempotencyKey,
      admin.id,
      correlationId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List refunds for a seller order' })
  list(
    @Param('sellerOrderId', ParseUUIDPipe) sellerOrderId: string,
  ): Promise<RefundView[]> {
    return this.refundsService.findBySellerOrder(sellerOrderId);
  }
}
