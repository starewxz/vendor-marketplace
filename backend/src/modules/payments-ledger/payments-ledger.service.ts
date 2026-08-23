import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';

@Injectable()
export class PaymentsLedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
  ) {}

  findBySellerProfileId(sellerProfileId: string): Promise<LedgerEntry[]> {
    return this.ledgerRepository.find({
      where: { sellerProfileId },
      order: { createdAt: 'DESC' },
    });
  }
}
