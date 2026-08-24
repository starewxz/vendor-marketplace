import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DisputeStatus } from '../entities/dispute-status.enum';

export class CreateDisputeDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @Length(3, 120) reason: string;
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @Length(10, 4000)
  description: string;
}

export class DisputeListQueryDto {
  @IsOptional() @IsEnum(DisputeStatus) status?: DisputeStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class SellerDisputeResponseDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @Length(3, 4000)
  response: string;
}

export enum DisputeResolutionOutcome {
  CUSTOMER = 'CUSTOMER',
  SELLER = 'SELLER',
}

export class DisputeRefundDto {
  @IsUUID() sellerOrderItemId: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() @Length(3, 500) reason?: string;
}

export class ResolveDisputeDto {
  @IsEnum(DisputeResolutionOutcome) outcome: DisputeResolutionOutcome;
  @IsString() @Length(3, 4000) adminResolution: string;
  @ApiPropertyOptional({ type: DisputeRefundDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DisputeRefundDto)
  refund?: DisputeRefundDto;
}

export class UpdateDisputeStatusDto {
  @IsEnum(DisputeStatus) status: DisputeStatus;
}
