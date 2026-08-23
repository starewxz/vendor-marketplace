import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';

export interface RecordOutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId: string;
}

/**
 * `record` must be called with the same EntityManager (`manager.transaction`
 * or a repository bound to an active transaction) as the domain write it
 * describes, so the event commits atomically with the change it represents.
 * A separate publisher worker (Stage 3+) polls PENDING rows outside of any
 * request's transaction and relays them to BullMQ.
 */
@Injectable()
export class OutboxService {
  async record(
    manager: EntityManager,
    input: RecordOutboxEventInput,
  ): Promise<OutboxEvent> {
    const event = manager.create(OutboxEvent, input);
    return manager.save(event);
  }
}
