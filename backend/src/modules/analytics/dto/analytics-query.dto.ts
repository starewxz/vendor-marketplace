import { IsDateString, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
