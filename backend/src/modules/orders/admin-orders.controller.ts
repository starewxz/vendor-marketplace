import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { AdminOrdersService } from './admin-orders.service';
import { OrderListQueryDto, PaginatedResult } from './dto/order-list-query.dto';
import {
  AdminOrderDetailView,
  AdminOrderListItemView,
} from './dto/admin-order-view';

@ApiTags('admin-orders')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List every order, with full financial visibility' })
  list(
    @Query() query: OrderListQueryDto,
  ): Promise<PaginatedResult<AdminOrderListItemView>> {
    return this.adminOrdersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any order, with full financial visibility' })
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminOrderDetailView> {
    return this.adminOrdersService.findById(id);
  }
}
