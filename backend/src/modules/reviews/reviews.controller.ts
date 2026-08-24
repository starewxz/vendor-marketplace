import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { UserRole } from '../users/entities/user-role.enum';
import {
  CreateReviewDto,
  ReviewListQueryDto,
  UpdateReviewDto,
} from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Public()
  @Get('products/:productId/reviews')
  @ApiOperation({ summary: 'List public verified-purchase reviews' })
  list(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviews.list(productId, query);
  }
  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @Get('products/:productId/review-eligibility')
  eligibility(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.reviews.eligibility(user.id, productId);
  }
  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @Post('products/:productId/reviews')
  create(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.reviews.create(user.id, productId, dto, correlationId);
  }
  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @Patch('reviews/:id')
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.reviews.update(user.id, id, dto, correlationId);
  }
  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @Delete('reviews/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.reviews.remove(user.id, id, correlationId);
  }
}
