import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from './entities/dispute.entity';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputesRepository: Repository<Dispute>,
  ) {}

  async findById(id: string): Promise<Dispute> {
    const dispute = await this.disputesRepository.findOne({ where: { id } });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    return dispute;
  }
}
