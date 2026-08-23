import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findPublished(): Promise<Product[]> {
    return this.productsService.findPublished();
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.findById(id);
  }
}
