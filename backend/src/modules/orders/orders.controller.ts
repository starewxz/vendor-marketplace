import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import { OrdersService } from './orders.service';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  CustomerOrderDetailView,
  CustomerOrderListItemView,
} from './dto/customer-order-view';

/**
 * Every handler resolves the buyer from the JWT-derived userId and scopes
 * the query by it — a productId/orderId in the URL never doubles as an
 * identity claim, so another customer's order id 404s instead of leaking.
 */
@ApiTags('orders')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List the current customer's orders" })
  list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: OrderListQueryDto,
  ): Promise<PaginatedResult<CustomerOrderListItemView>> {
    return this.ordersService.findMine(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get one of the current customer's own orders" })
  findById(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerOrderDetailView> {
    return this.ordersService.findMineById(user.id, id);
  }
}
