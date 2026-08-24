import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/utils/slug';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { Order } from '../orders/entities/order.entity';
import { SellerOrderStatus } from '../orders/entities/seller-order-status.enum';
import { OutboxService } from '../outbox/outbox.service';
import { RefundsService, RefundOutcome } from '../refunds/refunds.service';
import {
  CreateDisputeDto,
  DisputeListQueryDto,
  DisputeResolutionOutcome,
  ResolveDisputeDto,
  SellerDisputeResponseDto,
} from './dto/dispute.dto';
import { assertDisputeTransition } from './domain/dispute-status.policy';
import { Dispute } from './entities/dispute.entity';
import { DisputeStatus } from './entities/dispute-status.enum';

const ELIGIBLE_STATUSES = [
  SellerOrderStatus.SHIPPED,
  SellerOrderStatus.DELIVERED,
];

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);
  constructor(
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
    private readonly outbox: OutboxService,
    private readonly refunds: RefundsService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  async create(
    customerId: string,
    sellerOrderId: string,
    dto: CreateDisputeDto,
    correlationId: string,
  ) {
    try {
      const dispute = await this.disputes.manager.transaction(
        async (manager) => {
          const sellerOrder = await manager.findOne(SellerOrder, {
            where: { id: sellerOrderId },
            lock: { mode: 'pessimistic_write' },
          });
          const order = sellerOrder
            ? await manager.findOne(Order, {
                where: { id: sellerOrder.orderId },
              })
            : null;
          if (!sellerOrder || order?.buyerId !== customerId)
            throw new NotFoundException('Seller order not found');
          if (!ELIGIBLE_STATUSES.includes(sellerOrder.status))
            throw new ConflictException(
              'Only shipped or delivered seller orders are eligible for dispute',
            );
          const created = await manager.save(
            manager.create(Dispute, {
              sellerOrderId,
              customerId,
              sellerProfileId: sellerOrder.sellerProfileId,
              reason: dto.reason.trim(),
              description: dto.description.trim(),
              status: DisputeStatus.OPEN,
              resolvedByUserId: null,
              adminResolution: null,
              sellerResponse: null,
              resolvedAt: null,
            }),
          );
          await this.outbox.record(manager, {
            eventType: 'DISPUTE_OPENED',
            aggregateType: 'Dispute',
            aggregateId: created.id,
            payload: { disputeId: created.id, sellerOrderId },
            correlationId,
          });
          return created;
        },
      );
      this.metrics.increment('disputes_opened_total');
      this.logger.log(
        `[${correlationId}] dispute opened disputeId=${dispute.id} sellerOrderId=${sellerOrderId} customerId=${customerId}`,
      );
      return this.findCustomerById(customerId, dispute.id);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(
          'An active dispute already exists for this seller order',
        );
      throw error;
    }
  }

  listCustomer(customerId: string, query: DisputeListQueryDto) {
    return this.list(
      { customerId, ...(query.status ? { status: query.status } : {}) },
      query,
      false,
    );
  }
  listSeller(sellerProfileId: string, query: DisputeListQueryDto) {
    return this.list(
      { sellerProfileId, ...(query.status ? { status: query.status } : {}) },
      query,
      false,
    );
  }
  listAdmin(query: DisputeListQueryDto) {
    return this.list(query.status ? { status: query.status } : {}, query, true);
  }

  findCustomerById(customerId: string, id: string) {
    return this.findOne({ id, customerId }, false);
  }
  findSellerById(sellerProfileId: string, id: string) {
    return this.findOne({ id, sellerProfileId }, false);
  }
  findAdminById(id: string) {
    return this.findOne({ id }, true);
  }

  async sellerRespond(
    sellerProfileId: string,
    id: string,
    dto: SellerDisputeResponseDto,
    correlationId: string,
  ) {
    const dispute = await this.disputes.manager.transaction(async (manager) => {
      const row = await manager.findOne(Dispute, {
        where: { id, sellerProfileId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Dispute not found');
      if (
        ![DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW].includes(row.status)
      )
        throw new ConflictException(
          'Resolved disputes cannot be changed by the seller',
        );
      row.sellerResponse = dto.response.trim();
      await manager.save(row);
      await this.outbox.record(manager, {
        eventType: 'DISPUTE_STATUS_CHANGED',
        aggregateType: 'Dispute',
        aggregateId: row.id,
        payload: { disputeId: row.id },
        correlationId,
      });
      return row;
    });
    this.logger.log(
      `[${correlationId}] dispute seller response disputeId=${id} sellerId=${sellerProfileId}`,
    );
    return this.findSellerById(sellerProfileId, dispute.id);
  }

  async updateStatus(
    adminId: string,
    id: string,
    status: DisputeStatus,
    correlationId: string,
  ) {
    await this.disputes.manager.transaction(async (manager) => {
      const row = await manager.findOne(Dispute, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Dispute not found');
      if (![DisputeStatus.UNDER_REVIEW, DisputeStatus.CLOSED].includes(status))
        throw new BadRequestException(
          'Use the resolution endpoint for a customer/seller resolution',
        );
      assertDisputeTransition(row.status, status);
      row.status = status;
      if (status === DisputeStatus.CLOSED) {
        row.resolvedByUserId = adminId;
        row.resolvedAt = new Date();
      }
      await manager.save(row);
      await this.outbox.record(manager, {
        eventType: 'DISPUTE_STATUS_CHANGED',
        aggregateType: 'Dispute',
        aggregateId: row.id,
        payload: { disputeId: row.id, status },
        correlationId,
      });
    });
    this.logger.log(
      `[${correlationId}] dispute status changed disputeId=${id} status=${status}`,
    );
    return this.findAdminById(id);
  }

  async resolve(
    adminId: string,
    id: string,
    dto: ResolveDisputeDto,
    idempotencyKey: string | undefined,
    correlationId: string,
  ) {
    if (dto.refund && !idempotencyKey)
      throw new BadRequestException(
        'Idempotency-Key header is required when resolution includes a refund',
      );
    const result = await this.disputes.manager.transaction(async (manager) => {
      const row = await manager.findOne(Dispute, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Dispute not found');
      if (
        [
          DisputeStatus.RESOLVED_CUSTOMER,
          DisputeStatus.RESOLVED_SELLER,
          DisputeStatus.CLOSED,
        ].includes(row.status)
      )
        return { dispute: row, refundOutcome: null as RefundOutcome | null };
      const target =
        dto.outcome === DisputeResolutionOutcome.CUSTOMER
          ? DisputeStatus.RESOLVED_CUSTOMER
          : DisputeStatus.RESOLVED_SELLER;
      assertDisputeTransition(row.status, target);
      if (dto.refund) {
        if (dto.outcome !== DisputeResolutionOutcome.CUSTOMER)
          throw new BadRequestException(
            'A refund is only valid for a customer-favor resolution',
          );
        const refundOutcome = await this.refunds.createRefundInTransaction(
          manager,
          row.sellerOrderId,
          dto.refund,
          idempotencyKey as string,
          adminId,
          correlationId,
          row.id,
        );
        row.status = target;
        row.adminResolution = dto.adminResolution.trim();
        row.resolvedByUserId = adminId;
        row.resolvedAt = new Date();
        await manager.save(row);
        await this.outbox.record(manager, {
          eventType: 'DISPUTE_RESOLVED',
          aggregateType: 'Dispute',
          aggregateId: row.id,
          payload: {
            disputeId: row.id,
            status: target,
            refundId: refundOutcome.refund.id,
          },
          correlationId,
        });
        return { dispute: row, refundOutcome };
      }
      row.status = target;
      row.adminResolution = dto.adminResolution.trim();
      row.resolvedByUserId = adminId;
      row.resolvedAt = new Date();
      await manager.save(row);
      await this.outbox.record(manager, {
        eventType: 'DISPUTE_RESOLVED',
        aggregateType: 'Dispute',
        aggregateId: row.id,
        payload: { disputeId: row.id, status: target, refundId: null },
        correlationId,
      });
      return { dispute: row, refundOutcome: null as RefundOutcome | null };
    });
    if (result.refundOutcome) {
      await this.refunds.afterCommittedRefund(
        result.refundOutcome,
        correlationId,
      );
      this.logger.log(
        `[${correlationId}] dispute refund committed disputeId=${id} refundId=${result.refundOutcome.refund.id}`,
      );
    }
    this.metrics.increment('disputes_resolved_total');
    this.logger.log(
      `[${correlationId}] dispute resolved disputeId=${id} status=${result.dispute.status} adminId=${adminId}`,
    );
    return this.findAdminById(id);
  }

  private async list(
    where: FindOptionsWhere<Dispute>,
    query: DisputeListQueryDto,
    includeCustomer: boolean,
  ) {
    const [data, total] = await this.disputes.findAndCount({
      where,
      relations: {
        sellerOrder: { order: true, items: true },
        sellerProfile: true,
      },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: data.map((row) => this.toView(row, includeCustomer)),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }
  private async findOne(
    where: FindOptionsWhere<Dispute>,
    includeCustomer: boolean,
  ) {
    const row = await this.disputes.findOne({
      where,
      relations: {
        sellerOrder: { order: true, items: true, refunds: true },
        sellerProfile: true,
      },
    });
    if (!row) throw new NotFoundException('Dispute not found');
    return this.toView(row, includeCustomer);
  }

  private toView(row: Dispute, includeCustomer: boolean) {
    return {
      id: row.id,
      sellerOrderId: row.sellerOrderId,
      ...(includeCustomer ? { customerId: row.customerId } : {}),
      sellerProfileId: row.sellerProfileId,
      reason: row.reason,
      description: row.description,
      status: row.status,
      adminResolution: row.adminResolution,
      sellerResponse: row.sellerResponse,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sellerProfile: row.sellerProfile
        ? { id: row.sellerProfile.id, storeName: row.sellerProfile.storeName }
        : undefined,
      sellerOrder: row.sellerOrder
        ? {
            id: row.sellerOrder.id,
            status: row.sellerOrder.status,
            createdAt: row.sellerOrder.createdAt,
            items: row.sellerOrder.items?.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
              refundedQuantity:
                row.sellerOrder.refunds
                  ?.filter((refund) => refund.sellerOrderItemId === item.id)
                  .reduce((sum, refund) => sum + refund.quantity, 0) ?? 0,
            })),
          }
        : undefined,
    };
  }
}
