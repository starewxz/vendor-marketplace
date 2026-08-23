import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApplySellerDto {
  @ApiProperty({ example: "Jane's Vintage Finds" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @ApiProperty({
    example: 'I sell hand-restored vintage furniture, sourced locally.',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;
}
