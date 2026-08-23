import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { PaymentsLedgerService } from './payments-ledger.service';
import { PaymentsLedgerController } from './payments-ledger.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry])],
  controllers: [PaymentsLedgerController],
  providers: [PaymentsLedgerService],
  exports: [PaymentsLedgerService],
})
export class PaymentsLedgerModule {}
