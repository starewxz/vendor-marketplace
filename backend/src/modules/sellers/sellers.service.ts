import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellerApplication } from './entities/seller-application.entity';

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(SellerProfile)
    private readonly sellerProfilesRepository: Repository<SellerProfile>,
    @InjectRepository(SellerApplication)
    private readonly sellerApplicationsRepository: Repository<SellerApplication>,
  ) {}

  async findProfileById(id: string): Promise<SellerProfile> {
    const profile = await this.sellerProfilesRepository.findOne({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException(`Seller profile ${id} not found`);
    }
    return profile;
  }

  findApplicationsByUserId(userId: string): Promise<SellerApplication[]> {
    return this.sellerApplicationsRepository.find({ where: { userId } });
  }
}
