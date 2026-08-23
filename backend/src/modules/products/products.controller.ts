import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Marked @Public() per-method rather than at class level so future
  // mutating endpoints added here (create/update) default to requiring
  // auth instead of silently inheriting a public class-level flag.
  @Public()
  @Get()
  findPublished(): Promise<Product[]> {
    return this.productsService.findPublished();
  }

  @Public()
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.findById(id);
  }
}
