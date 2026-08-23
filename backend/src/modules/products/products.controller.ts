import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CatalogSearchResult } from './search/catalog-search.interface';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Search/browse the public catalog',
    description:
      'Backed by Meilisearch when available, with an automatic Postgres fallback (reduced facet quality) if the search engine is unreachable.',
  })
  search(
    @Query() query: CatalogQueryDto,
    @CorrelationId() correlationId: string,
  ): Promise<CatalogSearchResult> {
    return this.productsService.searchCatalog(query, correlationId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single published product' })
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.findPublicById(id);
  }
}
