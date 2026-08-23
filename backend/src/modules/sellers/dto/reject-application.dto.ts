import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectApplicationDto {
  @ApiProperty({ example: 'Business description was too vague to evaluate.' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}
