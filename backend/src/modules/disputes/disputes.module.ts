import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './entities/dispute.entity';
import { DisputesService } from './disputes.service';
import {
  AdminDisputesController,
  DisputesController,
  SellerDisputesController,
} from './disputes.controller';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { RefundsModule } from '../refunds/refunds.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, SellerOrder]),
    OutboxModule,
    RefundsModule,
    MetricsModule,
    SellersModule,
  ],
  controllers: [
    DisputesController,
    SellerDisputesController,
    AdminDisputesController,
  ],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
