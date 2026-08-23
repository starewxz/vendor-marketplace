import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Non-negative decimal with up to 2 fraction digits — matches the numeric(12,2) column. */
const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;
import { ProductType } from '../entities/product-type.enum';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Headphones' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({
    example: 'Noise-cancelling over-ear headphones.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ enum: ProductType, default: ProductType.FIXED_PRICE })
  @IsEnum(ProductType)
  type: ProductType;

  // Required for FIXED_PRICE; AUCTION pricing is configured on the Auction
  // entity in a later stage, so it's optional here and just carries an
  // optional starting reference price if the seller wants one displayed.
  @ApiProperty({ example: '49.99', required: false })
  @ValidateIf((dto: CreateProductDto) => dto.type === ProductType.FIXED_PRICE)
  @IsString()
  @Matches(PRICE_REGEX, {
    message:
      'price must be a non-negative number with at most 2 decimal places',
  })
  price?: string;

  @ApiProperty({ example: 25, default: 0 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockQuantity: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? true : value,
  )
  isPublished?: boolean;
}
