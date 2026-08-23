import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';

@ApiTags('reviews')
@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findByProductId(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<Review[]> {
    return this.reviewsService.findByProductId(productId);
  }
}
