import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Seller/admin analytics land in Stage 8+, likely as read-model queries
 * against the ledger/order tables rather than live aggregation. Holding a
 * DataSource here (instead of a single entity's Repository) reflects that
 * this module's queries will span multiple aggregates.
 */
@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}
}
