import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { SellerApplication } from './entities/seller-application.entity';
import { SellerApplicationStatus } from './entities/seller-application-status.enum';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';

@ApiTags('admin-seller-applications')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/seller-applications')
export class AdminSellerApplicationsController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @ApiOperation({ summary: 'List seller applications' })
  @ApiQuery({ name: 'status', enum: SellerApplicationStatus, required: false })
  list(
    @Query('status') status?: SellerApplicationStatus,
  ): Promise<SellerApplication[]> {
    return this.sellersService.listApplications(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single seller application' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<SellerApplication> {
    return this.sellersService.findApplicationById(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a PENDING seller application' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedRequestUser,
    @CorrelationId() correlationId: string,
  ): Promise<SellerApplication> {
    return this.sellersService.approveApplication(id, admin.id, correlationId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a PENDING seller application' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectApplicationDto,
    @CurrentUser() admin: AuthenticatedRequestUser,
    @CorrelationId() correlationId: string,
  ): Promise<SellerApplication> {
    return this.sellersService.rejectApplication(
      id,
      admin.id,
      dto.reason,
      correlationId,
    );
  }
}
