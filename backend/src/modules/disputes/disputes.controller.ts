import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { SellersService } from '../sellers/sellers.service';
import { UserRole } from '../users/entities/user-role.enum';
import {
  CreateDisputeDto,
  DisputeListQueryDto,
  ResolveDisputeDto,
  SellerDisputeResponseDto,
  UpdateDisputeStatusDto,
} from './dto/dispute.dto';
import { DisputesService } from './disputes.service';

@ApiTags('disputes')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}
  @Post('seller-orders/:sellerOrderId/disputes')
  @ApiOperation({
    summary: 'Open a dispute for one of the current customer’s seller orders',
  })
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('sellerOrderId', ParseUUIDPipe) sellerOrderId: string,
    @Body() dto: CreateDisputeDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.disputes.create(user.id, sellerOrderId, dto, correlationId);
  }
  @Get('disputes') list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: DisputeListQueryDto,
  ) {
    return this.disputes.listCustomer(user.id, query);
  }
  @Get('disputes/:id') find(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.disputes.findCustomerById(user.id, id);
  }
}

@ApiTags('seller-disputes')
@ApiBearerAuth()
@Roles(UserRole.SELLER)
@Controller('seller/disputes')
export class SellerDisputesController {
  constructor(
    private readonly disputes: DisputesService,
    private readonly sellers: SellersService,
  ) {}
  @Get() async list(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: DisputeListQueryDto,
  ) {
    const seller = await this.sellers.findProfileByUserId(user.id);
    return this.disputes.listSeller(seller.id, query);
  }
  @Get(':id') async find(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const seller = await this.sellers.findProfileByUserId(user.id);
    return this.disputes.findSellerById(seller.id, id);
  }
  @Patch(':id/response') async respond(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SellerDisputeResponseDto,
    @CorrelationId() correlationId: string,
  ) {
    const seller = await this.sellers.findProfileByUserId(user.id);
    return this.disputes.sellerRespond(seller.id, id, dto, correlationId);
  }
}

@ApiTags('admin-disputes')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/disputes')
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}
  @Get() list(@Query() query: DisputeListQueryDto) {
    return this.disputes.listAdmin(query);
  }
  @Get(':id') find(@Param('id', ParseUUIDPipe) id: string) {
    return this.disputes.findAdminById(id);
  }
  @Patch(':id/status') updateStatus(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisputeStatusDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.disputes.updateStatus(user.id, id, dto.status, correlationId);
  }
  @Post(':id/resolve')
  @ApiOperation({
    summary:
      'Resolve a dispute, optionally coordinating an idempotent Stage 5 refund in the same transaction',
  })
  resolve(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @Headers('idempotency-key') key: string | undefined,
    @CorrelationId() correlationId: string,
  ) {
    return this.disputes.resolve(user.id, id, dto, key, correlationId);
  }
}
