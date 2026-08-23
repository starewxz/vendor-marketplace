import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsLedgerService } from './payments-ledger.service';
import { LedgerEntry } from './entities/ledger-entry.entity';

@ApiTags('payments-ledger')
@Controller('sellers/:sellerProfileId/ledger')
export class PaymentsLedgerController {
  constructor(private readonly paymentsLedgerService: PaymentsLedgerService) {}

  @Get()
  findBySellerProfileId(
    @Param('sellerProfileId', ParseUUIDPipe) sellerProfileId: string,
  ): Promise<LedgerEntry[]> {
    return this.paymentsLedgerService.findBySellerProfileId(sellerProfileId);
  }
}
