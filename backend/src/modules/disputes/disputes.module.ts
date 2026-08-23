import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './entities/dispute.entity';
import { Refund } from './entities/refund.entity';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Dispute, Refund])],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
