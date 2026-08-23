import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Category> {
    return this.categoriesService.findById(id);
  }
}
