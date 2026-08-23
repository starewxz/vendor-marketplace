import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
  ) {}

  findByProductId(productId: string): Promise<Review[]> {
    return this.reviewsRepository.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }
}
