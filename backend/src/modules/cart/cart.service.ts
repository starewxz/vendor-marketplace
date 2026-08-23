import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly cartsRepository: Repository<Cart>,
  ) {}

  findByUserId(userId: string): Promise<Cart | null> {
    return this.cartsRepository.findOne({
      where: { userId },
      relations: { items: true },
    });
  }
}
