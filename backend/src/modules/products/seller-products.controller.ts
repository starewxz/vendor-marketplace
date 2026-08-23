import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { SellersService } from '../sellers/sellers.service';

/**
 * Every handler resolves the caller's SellerProfile from the JWT-derived
 * userId (never trusts a sellerId/sellerProfileId in the request body or
 * params), then delegates to ProductsService's ownership-scoped queries —
 * a mismatch reads as 404, not 403, so another seller's product id isn't
 * confirmed to exist.
 */
@ApiTags('seller-products')
@ApiBearerAuth()
@Roles(UserRole.SELLER)
@Controller('seller/products')
export class SellerProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly sellersService: SellersService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the current seller's own products" })
  async findMine(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): Promise<Product[]> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.productsService.findOwnedList(profile.id);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get one of the current seller's own products" })
  async findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.productsService.findOwnedById(id, profile.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product owned by the current seller' })
  async create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateProductDto,
    @CorrelationId() correlationId: string,
  ): Promise<Product> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.productsService.createForSeller(profile.id, dto, correlationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update one of the current seller's own products" })
  async update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CorrelationId() correlationId: string,
  ): Promise<Product> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    return this.productsService.updateOwned(id, profile.id, dto, correlationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete one of the current seller's own products" })
  async remove(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    const profile = await this.sellersService.findProfileByUserId(user.id);
    await this.productsService.deleteOwned(id, profile.id, correlationId);
  }
}
