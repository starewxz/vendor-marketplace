import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.ordersService.findById(id);
  }
}
