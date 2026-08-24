import { Body, Controller, Post } from '@nestjs/common';
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
import { CheckoutService } from './checkout.service';
import { CheckoutRequestDto } from './dto/checkout-request.dto';
import { CheckoutResult } from './dto/checkout-result';

@ApiTags('checkout')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('cart/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated unique key. Retrying the same key returns the original order instead of creating a duplicate.',
  })
  @ApiOperation({
    summary:
      "Check out the current customer's cart: one Order split into one SellerOrder per seller, atomic stock deduction, commission, and ledger entries",
  })
  @ApiResponse({
    status: 201,
    type: CheckoutResult,
    description:
      'Order created (or, if the Idempotency-Key was already used to completion, the original order is returned with replayed: true).',
  })
  @ApiResponse({
    status: 400,
    description:
      'Missing/invalid Idempotency-Key header, or the cart is empty.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated as a non-CUSTOMER role.',
  })
  @ApiResponse({
    status: 409,
    description:
      'A product in the cart is no longer purchasable, or is out of stock at checkout time — nothing was charged or reserved.',
  })
  checkout(
    @CurrentUser() user: AuthenticatedRequestUser,
    @IdempotencyKeyHeader() idempotencyKey: string | undefined,
    @CorrelationId() correlationId: string,
    @Body() dto: CheckoutRequestDto,
  ): Promise<CheckoutResult> {
    return this.checkoutService.checkout(
      user.id,
      idempotencyKey,
      correlationId,
      dto,
    );
  }
}
