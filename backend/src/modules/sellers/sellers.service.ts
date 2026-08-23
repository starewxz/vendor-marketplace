import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellerApplication } from './entities/seller-application.entity';
import { SellerApplicationStatus } from './entities/seller-application-status.enum';
import { ApplySellerDto } from './dto/apply-seller.dto';
import { slugify } from './utils/slugify';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { OutboxService } from '../outbox/outbox.service';

const OUTBOX_AGGREGATE_TYPE = 'SellerApplication';

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  constructor(
    @InjectRepository(SellerProfile)
    private readonly sellerProfilesRepository: Repository<SellerProfile>,
    @InjectRepository(SellerApplication)
    private readonly sellerApplicationsRepository: Repository<SellerApplication>,
    private readonly outboxService: OutboxService,
  ) {}

  async findProfileById(id: string): Promise<SellerProfile> {
    const profile = await this.sellerProfilesRepository.findOne({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException(`Seller profile ${id} not found`);
    }
    return profile;
  }

  /**
   * Resolves the SellerProfile for the authenticated user (JWT carries a
   * userId, not a sellerProfileId). A user with role SELLER always has a
   * profile — it's created atomically with role approval — so a miss here
   * indicates a data inconsistency, not a normal "not a seller yet" case.
   */
  async findProfileByUserId(userId: string): Promise<SellerProfile> {
    const profile = await this.sellerProfilesRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(`No seller profile found for user ${userId}`);
    }
    return profile;
  }

  findApplicationsByUserId(userId: string): Promise<SellerApplication[]> {
    return this.sellerApplicationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findApplicationById(id: string): Promise<SellerApplication> {
    const application = await this.sellerApplicationsRepository.findOne({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException(`Seller application ${id} not found`);
    }
    return application;
  }

  listApplications(
    status?: SellerApplicationStatus,
  ): Promise<SellerApplication[]> {
    return this.sellerApplicationsRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * A user may have at most one PENDING application (enforced by both this
   * check and a DB partial unique index — the index is what actually
   * prevents a race between two concurrent submissions).
   */
  async applyForSeller(
    userId: string,
    userRole: UserRole,
    dto: ApplySellerDto,
    correlationId: string,
  ): Promise<SellerApplication> {
    if (userRole === UserRole.SELLER || userRole === UserRole.ADMIN) {
      throw new ConflictException('You already have seller access');
    }

    const existingPending = await this.sellerApplicationsRepository.findOne({
      where: { userId, status: SellerApplicationStatus.PENDING },
    });
    if (existingPending) {
      throw new ConflictException(
        'You already have a pending seller application',
      );
    }

    const application =
      await this.sellerApplicationsRepository.manager.transaction(
        async (manager) => {
          const created = await manager.save(
            manager.create(SellerApplication, {
              userId,
              requestedStoreName: dto.businessName,
              businessDescription: dto.description,
              status: SellerApplicationStatus.PENDING,
            }),
          );

          await this.outboxService.record(manager, {
            eventType: 'SELLER_APPLICATION_CREATED',
            aggregateType: OUTBOX_AGGREGATE_TYPE,
            aggregateId: created.id,
            payload: { userId, businessName: dto.businessName },
            correlationId,
          });

          return created;
        },
      );

    this.logger.log({
      msg: 'seller application submitted',
      userId,
      applicationId: application.id,
    });
    return application;
  }

  /**
   * Transactional: locks the application row, verifies it is still PENDING
   * (guards against double-approve races and stale admin UI state), then
   * approves it, creates the SellerProfile, and grants the SELLER role — all
   * or nothing. The SellerProfile's unique (userId) index is a second line
   * of defense against ever creating two profiles for one user.
   */
  async approveApplication(
    applicationId: string,
    adminUserId: string,
    correlationId: string,
  ): Promise<SellerApplication> {
    return this.sellerApplicationsRepository.manager.transaction(
      async (manager) => {
        const application = await manager
          .createQueryBuilder(SellerApplication, 'app')
          .setLock('pessimistic_write')
          .where('app.id = :id', { id: applicationId })
          .getOne();

        if (!application) {
          throw new NotFoundException(
            `Seller application ${applicationId} not found`,
          );
        }
        if (application.status !== SellerApplicationStatus.PENDING) {
          throw new ConflictException(
            `Application is already ${application.status.toLowerCase()} and cannot be approved again`,
          );
        }

        const existingProfile = await manager.findOne(SellerProfile, {
          where: { userId: application.userId },
        });
        if (existingProfile) {
          // Defensive: should be unreachable given the PENDING-only invariant,
          // but never silently create a second profile for the same user.
          throw new ConflictException('This user already has a seller profile');
        }

        application.status = SellerApplicationStatus.APPROVED;
        application.reviewedByUserId = adminUserId;
        application.reviewedAt = new Date();
        await manager.save(application);

        const storeSlug = await this.generateUniqueSlug(
          manager,
          application.requestedStoreName,
        );
        await manager.save(
          manager.create(SellerProfile, {
            userId: application.userId,
            storeName: application.requestedStoreName,
            storeSlug,
            description: application.businessDescription,
          }),
        );

        await manager.update(
          User,
          { id: application.userId },
          { role: UserRole.SELLER },
        );

        await this.outboxService.record(manager, {
          eventType: 'SELLER_APPLICATION_APPROVED',
          aggregateType: OUTBOX_AGGREGATE_TYPE,
          aggregateId: application.id,
          payload: { userId: application.userId, storeSlug },
          correlationId,
        });

        this.logger.log({
          msg: 'seller approved',
          applicationId: application.id,
          userId: application.userId,
          adminUserId,
        });

        return application;
      },
    );
  }

  async rejectApplication(
    applicationId: string,
    adminUserId: string,
    reason: string,
    correlationId: string,
  ): Promise<SellerApplication> {
    return this.sellerApplicationsRepository.manager.transaction(
      async (manager) => {
        const application = await manager
          .createQueryBuilder(SellerApplication, 'app')
          .setLock('pessimistic_write')
          .where('app.id = :id', { id: applicationId })
          .getOne();

        if (!application) {
          throw new NotFoundException(
            `Seller application ${applicationId} not found`,
          );
        }
        if (application.status !== SellerApplicationStatus.PENDING) {
          throw new ConflictException(
            `Application is already ${application.status.toLowerCase()} and cannot be rejected again`,
          );
        }

        application.status = SellerApplicationStatus.REJECTED;
        application.reviewedByUserId = adminUserId;
        application.reviewedAt = new Date();
        application.rejectionReason = reason;
        await manager.save(application);

        await this.outboxService.record(manager, {
          eventType: 'SELLER_APPLICATION_REJECTED',
          aggregateType: OUTBOX_AGGREGATE_TYPE,
          aggregateId: application.id,
          payload: { userId: application.userId, reason },
          correlationId,
        });

        this.logger.log({
          msg: 'seller rejected',
          applicationId: application.id,
          userId: application.userId,
          adminUserId,
        });

        return application;
      },
    );
  }

  private async generateUniqueSlug(
    manager: EntityManager,
    base: string,
  ): Promise<string> {
    const baseSlug = slugify(base) || 'store';
    let candidate = baseSlug;
    let attempt = 0;

    while (
      await manager.findOne(SellerProfile, { where: { storeSlug: candidate } })
    ) {
      attempt += 1;
      candidate = `${baseSlug}-${randomBytes(2).toString('hex')}`;
      if (attempt > 5) break;
    }
    return candidate;
  }
}
