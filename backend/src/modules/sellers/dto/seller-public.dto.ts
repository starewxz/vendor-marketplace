import { ApiProperty } from '@nestjs/swagger';
import { SellerProfile } from '../entities/seller-profile.entity';

/**
 * Public-facing seller profile. Excludes userId and commissionRatePercent —
 * those are internal/business-sensitive and must never be exposed to
 * unauthenticated catalog browsers or other sellers.
 */
export class SellerPublicDto {
  @ApiProperty() id: string;
  @ApiProperty() storeName: string;
  @ApiProperty() storeSlug: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) logoUrl: string | null;
  @ApiProperty() isActive: boolean;

  static fromEntity(profile: SellerProfile): SellerPublicDto {
    const dto = new SellerPublicDto();
    dto.id = profile.id;
    dto.storeName = profile.storeName;
    dto.storeSlug = profile.storeSlug;
    dto.description = profile.description;
    dto.logoUrl = profile.logoUrl;
    dto.isActive = profile.isActive;
    return dto;
  }
}
