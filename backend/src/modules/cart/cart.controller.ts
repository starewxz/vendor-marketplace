import {
  Body,
  Controller,
  Delete,
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
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartView } from './dto/cart-view';

/**
 * Every handler resolves the cart from the JWT-derived userId — a
 * productId in the URL never doubles as an identity claim, so there is no
 * cross-customer cart access surface to test for.
 */
@ApiTags('cart')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: "Get the current customer's cart, grouped by seller",
  })
  getCart(@CurrentUser() user: AuthenticatedRequestUser): Promise<CartView> {
    return this.cartService.getCartView(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a fixed-price product to the cart' })
  @ApiResponse({
    status: 400,
    description: 'The product is an auction listing, not fixed-price.',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found or unpublished.',
  })
  @ApiResponse({
    status: 409,
    description: 'Requested quantity exceeds current stock.',
  })
  addItem(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartView> {
    return this.cartService.addItem(user.id, dto.productId, dto.quantity);
  }

  @Patch('items/:productId')
  @ApiOperation({ summary: 'Set the quantity of a cart line item' })
  @ApiResponse({ status: 404, description: 'Product is not in the cart.' })
  @ApiResponse({
    status: 409,
    description: 'Requested quantity exceeds current stock.',
  })
  updateItem(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cartService.updateItemQuantity(
      user.id,
      productId,
      dto.quantity,
    );
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove a line item from the cart' })
  removeItem(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<CartView> {
    return this.cartService.removeItem(user.id, productId);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove all items from the cart' })
  clearCart(@CurrentUser() user: AuthenticatedRequestUser): Promise<CartView> {
    return this.cartService.clearCart(user.id);
  }
}
