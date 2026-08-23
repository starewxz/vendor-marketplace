import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
  ) {}

  async findById(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { sellerOrders: { items: true } },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  findByBuyerId(buyerId: string): Promise<Order[]> {
    return this.ordersRepository.find({
      where: { buyerId },
      relations: { sellerOrders: true },
    });
  }
}
