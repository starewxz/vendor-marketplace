import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('by-user/:userId')
  findByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<Cart | null> {
    return this.cartService.findByUserId(userId);
  }
}
