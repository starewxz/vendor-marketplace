import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refund } from './entities/refund.entity';
import { RefundsService } from './refunds.service';
import { AdminRefundsController } from './admin-refunds.controller';
import { OutboxModule } from '../outbox/outbox.module';

/**
 * The refund transaction touches SellerOrder/SellerOrderItem/Product/
 * LedgerEntry via the shared EntityManager directly (`manager.find/save`),
 * not injected repositories — those entities are already registered on
 * the app's single DataSource by their owning modules, so only Refund
 * needs `forFeature` here for the one `@InjectRepository` this module uses.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Refund]), OutboxModule],
  controllers: [AdminRefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
