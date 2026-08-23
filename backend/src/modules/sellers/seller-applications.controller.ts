import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { ApplySellerDto } from './dto/apply-seller.dto';
import { SellerApplication } from './entities/seller-application.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';

/**
 * Customer-facing seller application endpoints. Identity always comes from
 * the authenticated principal (@CurrentUser), never from the request body —
 * a customer cannot submit an application "as" another user.
 */
@ApiTags('seller-applications')
@ApiBearerAuth()
@Controller('seller-applications')
export class SellerApplicationsController {
  constructor(private readonly sellersService: SellersService) {}

  @Post()
  @ApiOperation({ summary: 'Apply to become a seller' })
  applyForSeller(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
    @Body() dto: ApplySellerDto,
    @CorrelationId() correlationId: string,
  ): Promise<SellerApplication> {
    return this.sellersService.applyForSeller(
      currentUser.id,
      currentUser.role,
      dto,
      correlationId,
    );
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the current user's seller applications" })
  findMine(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
  ): Promise<SellerApplication[]> {
    return this.sellersService.findApplicationsByUserId(currentUser.id);
  }
}
