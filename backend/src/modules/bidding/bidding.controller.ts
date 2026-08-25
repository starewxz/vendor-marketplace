import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { IdempotencyKeyHeader } from '../../common/decorators/idempotency-key.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import { BiddingService } from './bidding.service';
import { BidPlacementService } from './bid-placement.service';
import { AuctionCheckoutService } from './auction-checkout.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionCheckoutRequestDto } from './dto/auction-checkout-request.dto';
import { AuctionCheckoutResult } from './dto/auction-checkout-result';
import { AuctionPublicView } from './dto/auction-public-view';
import { BidHistoryItemView } from './dto/bid-history-item-view';
import { BidAcceptedView } from './dto/auction-public-view';
import { AuctionWinnerStateView } from './dto/auction-public-view';

@ApiTags('bidding')
@Controller('auctions')
export class BiddingController {
  constructor(
    private readonly biddingService: BiddingService,
    private readonly bidPlacementService: BidPlacementService,
    private readonly auctionCheckoutService: AuctionCheckoutService,
  ) {}

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single auction (public, no bidder identities)',
  })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<AuctionPublicView> {
    return this.biddingService.findById(id);
  }

  @Public()
  @Get(':id/bids')
  @ApiOperation({
    summary: 'Bid history for an auction (public, anonymized bidder labels)',
  })
  findBidHistory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BidHistoryItemView[]> {
    return this.biddingService.findBidHistory(id, undefined);
  }

  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @Get(':id/winner-state')
  @ApiOperation({
    summary:
      'Return winner-only purchase-window state for the authenticated customer',
  })
  winnerState(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) auctionId: string,
  ): Promise<AuctionWinnerStateView> {
    return this.biddingService.winnerState(auctionId, user.id);
  }

  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  // Overrides the 'default' throttler's limit/ttl for this route only — a
  // single named throttler is used deliberately (see app.module.ts):
  // registering a second named throttler would apply it to every route by
  // default (@nestjs/throttler runs all configured throttlers globally
  // unless explicitly skipped), which would rate-limit unrelated endpoints
  // too, not just this one.
  @Throttle({ default: { limit: 20, ttl: 10_000 } })
  @Post(':id/bids')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated unique key. Retrying the same key returns the original bid instead of creating a duplicate.',
  })
  @ApiOperation({
    summary:
      'Place a bid on an active auction — concurrency-safe via a row lock on the auction, evaluated inside the transaction',
  })
  @ApiResponse({ status: 201, description: 'Bid accepted.' })
  @ApiResponse({
    status: 400,
    description:
      'Missing/invalid Idempotency-Key header, or a malformed amount.',
  })
  @ApiResponse({
    status: 409,
    description:
      'The auction is not currently open for bidding, or the amount is below the required minimum next bid.',
  })
  placeBid(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) auctionId: string,
    @IdempotencyKeyHeader() idempotencyKey: string | undefined,
    @CorrelationId() correlationId: string,
    @Body() dto: PlaceBidDto,
  ): Promise<BidAcceptedView> {
    return this.bidPlacementService.placeBid(
      user.id,
      auctionId,
      idempotencyKey,
      correlationId,
      dto,
    );
  }

  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @Post(':id/checkout')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated unique key. Retrying the same key returns the original order instead of creating a duplicate.',
  })
  @ApiOperation({
    summary:
      'Winner-only purchase at the winning bid price, inside the purchase window — reuses the Order/SellerOrder/commission/ledger machinery, not the cart',
  })
  @ApiResponse({ status: 201, type: AuctionCheckoutResult })
  @ApiResponse({
    status: 403,
    description: "The caller is not this auction's winner.",
  })
  @ApiResponse({
    status: 409,
    description:
      'The auction is not awaiting payment, or the purchase window has expired.',
  })
  checkout(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) auctionId: string,
    @IdempotencyKeyHeader() idempotencyKey: string | undefined,
    @CorrelationId() correlationId: string,
    @Body() dto: AuctionCheckoutRequestDto,
  ): Promise<AuctionCheckoutResult> {
    return this.auctionCheckoutService.checkout(
      user.id,
      auctionId,
      idempotencyKey,
      correlationId,
      dto,
    );
  }
}
