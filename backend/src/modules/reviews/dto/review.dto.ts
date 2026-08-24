import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sellerOrderItemId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  comment?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  comment?: string;
}

export class ReviewListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 10;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest', 'lowest'])
  sort: 'newest' | 'oldest' | 'highest' | 'lowest' = 'newest';
}

export interface ReviewView {
  id: string;
  productId: string;
  sellerOrderItemId: string;
  rating: number;
  comment: string | null;
  customerDisplayName: string;
  isMine: boolean;
  createdAt: Date;
  updatedAt: Date;
}
