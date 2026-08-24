import { Controller, Get, Header, Logger, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { SellersService } from '../sellers/sellers.service';
import { UserRole } from '../users/entities/user-role.enum';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('seller-analytics')
@ApiBearerAuth()
@Roles(UserRole.SELLER)
@Controller('seller/analytics')
export class SellerAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly sellers: SellersService,
  ) {}
  @Get('overview')
  @ApiOperation({
    summary:
      'Current seller revenue, order, catalog, daily sales, and top-product read model',
  })
  async overview(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const seller = await this.sellers.findProfileByUserId(user.id);
    return this.analytics.sellerOverview(seller.id, query);
  }
  @Get('sales') async sales(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const seller = await this.sellers.findProfileByUserId(user.id);
    return (await this.analytics.sellerOverview(seller.id, query)).daily;
  }
  @Get('top-products') async topProducts(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const seller = await this.sellers.findProfileByUserId(user.id);
    return (await this.analytics.sellerOverview(seller.id, query)).topProducts;
  }
}

@ApiTags('admin-analytics')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  private readonly logger = new Logger(AdminAnalyticsController.name);
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly metrics: MetricsRegistryService,
  ) {}
  @Get()
  @ApiOperation({
    summary:
      'Marketplace financial and operational analytics with previous-period comparison',
  })
  overview(@Query() query: AnalyticsQueryDto) {
    return this.analytics.adminReport(query);
  }
  @Get('export.json')
  @Header(
    'Content-Disposition',
    'attachment; filename="marketplace-report.json"',
  )
  async json(
    @Query() query: AnalyticsQueryDto,
    @CorrelationId() correlationId: string,
  ) {
    this.metrics.increment('analytics_exports_total');
    this.logger.log(`[${correlationId}] analytics JSON export created`);
    return {
      ...(await this.analytics.adminReport(query)),
      generatedAt: new Date().toISOString(),
      correlationId,
    };
  }
  @Get('export.csv')
  @ApiProduces('text/csv')
  async csv(
    @Query() query: AnalyticsQueryDto,
    @Res({ passthrough: true }) response: Response,
    @CorrelationId() correlationId: string,
  ) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="marketplace-report.csv"',
    );
    this.metrics.increment('analytics_exports_total');
    this.logger.log(`[${correlationId}] analytics CSV export created`);
    return this.analytics.exportCsv(query);
  }
}
