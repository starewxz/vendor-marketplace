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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import { SellersService } from '../sellers/sellers.service';
import { SellerAuctionsService } from './seller-auctions.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { UpdateAuctionDto } from './dto/update-auction.dto';
import { AuctionSellerView } from './dto/auction-seller-view';

/**
 * Every handler resolves the caller's SellerProfile from the JWT-derived
 * userId, then delegates to SellerAuctionsService's ownership-scoped
 * queries — mirrors SellerProductsController/SellerOrdersController.
 */
@ApiTags('seller-auctions')
@ApiBearerAuth()
@Roles(UserRole.SELLER)
@Controller('seller/auctions')
export class SellerAuctionsController {
  constructor(
    private readonly sellerAuctionsService: SellerAuctionsService,
    private readonly sellersService: SellersService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the current seller's own auctions" })
  async findMine(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<AuctionSellerView[]> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.sellerAuctionsService.findMine(profile.id);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get one of the current seller's own auctions" })
  async findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuctionSellerView> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.sellerAuctionsService.findMineById(id, profile.id);
  }

  @Post()
  @ApiOperation({
    summary:
      "Create an auction for one of the current seller's own AUCTION-type products",
  })
  @ApiResponse({
    status: 409,
    description: 'This product already has an auction.',
  })
  async create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateAuctionDto,
    @CorrelationId() correlationId: string,
  ): Promise<AuctionSellerView> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.sellerAuctionsService.create(profile.id, dto, correlationId);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      "Update one of the current seller's own auctions — only while it still has zero bids",
  })
  @ApiResponse({
    status: 409,
    description:
      'The auction already has bids, or has ended — no longer editable.',
  })
  async update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuctionDto,
    @CorrelationId() correlationId: string,
  ): Promise<AuctionSellerView> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.sellerAuctionsService.update(
      id,
      profile.id,
      dto,
      correlationId,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      "Cancel one of the current seller's own auctions (only before a winner is determined)",
  })
  @ApiResponse({
    status: 409,
    description:
      'The auction is past the cancellable window (already ended or completed).',
  })
  async cancel(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<AuctionSellerView> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.sellerAuctionsService.cancel(id, profile.id, correlationId);
  }
}
