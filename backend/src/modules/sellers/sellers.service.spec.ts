/* eslint-disable @typescript-eslint/no-unsafe-return -- jest.fn() mock typing */
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SellersService } from './sellers.service';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellerApplication } from './entities/seller-application.entity';
import { SellerApplicationStatus } from './entities/seller-application-status.enum';
import { UserRole } from '../users/entities/user-role.enum';
import { OutboxService } from '../outbox/outbox.service';

describe('SellersService', () => {
  let service: SellersService;
  let sellerApplicationsRepository: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let outboxService: { record: jest.Mock };
  let fakeManager: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let qb: { setLock: jest.Mock; where: jest.Mock; getOne: jest.Mock };

  beforeEach(async () => {
    qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    fakeManager = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      save: jest.fn((x) => x),
      create: jest.fn((_entity, data) => data),
      update: jest.fn(),
    };
    sellerApplicationsRepository = {
      findOne: jest.fn(),
      manager: {
        ...fakeManager,
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
      },
    };
    outboxService = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SellersService,
        {
          provide: getRepositoryToken(SellerProfile),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(SellerApplication),
          useValue: sellerApplicationsRepository,
        },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = moduleRef.get(SellersService);
  });

  describe('applyForSeller', () => {
    it('creates a PENDING application for a CUSTOMER with no existing pending application', async () => {
      sellerApplicationsRepository.findOne.mockResolvedValue(null);

      const result = await service.applyForSeller(
        'user-1',
        UserRole.CUSTOMER,
        { businessName: 'Store', description: 'a'.repeat(20) },
        'corr-1',
      );

      expect(result.status).toBe(SellerApplicationStatus.PENDING);
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'SELLER_APPLICATION_CREATED' }),
      );
    });

    it('rejects a user who already has SELLER role', async () => {
      await expect(
        service.applyForSeller(
          'user-1',
          UserRole.SELLER,
          { businessName: 'x', description: 'a'.repeat(20) },
          'c',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a second PENDING application from the same user', async () => {
      sellerApplicationsRepository.findOne.mockResolvedValue({
        id: 'app-1',
        status: SellerApplicationStatus.PENDING,
      });

      await expect(
        service.applyForSeller(
          'user-1',
          UserRole.CUSTOMER,
          { businessName: 'x', description: 'a'.repeat(20) },
          'c',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('approveApplication', () => {
    it('approves a PENDING application, creates a SellerProfile, and grants SELLER role', async () => {
      qb.getOne.mockResolvedValue({
        id: 'app-1',
        userId: 'user-1',
        requestedStoreName: 'Jane Store',
        businessDescription: 'desc',
        status: SellerApplicationStatus.PENDING,
      });
      fakeManager.findOne.mockResolvedValueOnce(null); // no existing SellerProfile
      fakeManager.findOne.mockResolvedValueOnce(null); // slug uniqueness check passes

      const result = await service.approveApplication(
        'app-1',
        'admin-1',
        'corr-1',
      );

      expect(result.status).toBe(SellerApplicationStatus.APPROVED);
      expect(fakeManager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'user-1' },
        { role: UserRole.SELLER },
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'SELLER_APPLICATION_APPROVED' }),
      );
    });

    it('rejects approving a non-PENDING application (idempotency / invalid transition)', async () => {
      qb.getOne.mockResolvedValue({
        id: 'app-1',
        status: SellerApplicationStatus.APPROVED,
      });

      await expect(
        service.approveApplication('app-1', 'admin-1', 'corr-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(fakeManager.save).not.toHaveBeenCalled();
    });

    it('refuses to create a second SellerProfile if one already exists for the user', async () => {
      qb.getOne.mockResolvedValue({
        id: 'app-1',
        userId: 'user-1',
        requestedStoreName: 'Jane Store',
        status: SellerApplicationStatus.PENDING,
      });
      fakeManager.findOne.mockResolvedValueOnce({ id: 'existing-profile' });

      await expect(
        service.approveApplication('app-1', 'admin-1', 'corr-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('rejectApplication', () => {
    it('rejects a PENDING application and records the reason', async () => {
      qb.getOne.mockResolvedValue({
        id: 'app-1',
        userId: 'user-1',
        status: SellerApplicationStatus.PENDING,
      });

      const result = await service.rejectApplication(
        'app-1',
        'admin-1',
        'Not enough detail',
        'corr-1',
      );

      expect(result.status).toBe(SellerApplicationStatus.REJECTED);
      expect(result.rejectionReason).toBe('Not enough detail');
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'SELLER_APPLICATION_REJECTED' }),
      );
    });

    it('rejects rejecting an already-decided application', async () => {
      qb.getOne.mockResolvedValue({
        id: 'app-1',
        status: SellerApplicationStatus.REJECTED,
      });

      await expect(
        service.rejectApplication('app-1', 'admin-1', 'reason', 'corr-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
