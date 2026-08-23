import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';

/**
 * Concurrency-safe bid placement (optimistic locking via Auction.version, or
 * a pessimistic `SELECT ... FOR UPDATE`) lands in Stage 6. For now this only
 * exposes read access so the schema can be exercised end-to-end.
 */
@Injectable()
export class BiddingService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
  ) {}

  async findById(id: string): Promise<Auction> {
    const auction = await this.auctionsRepository.findOne({ where: { id } });
    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }
    return auction;
  }
}
