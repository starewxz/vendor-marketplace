import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const CACHE_TTL_SECONDS = 45;

interface Period {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}
interface MoneyRow {
  gross: string;
  commission: string;
  net: string;
  refunds: string;
  orders: string;
}
interface CountRow {
  count: string;
}

export function percentageChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export function protectCsvValue(value: unknown): string {
  let text: string;
  if (value == null) text = '';
  else if (typeof value === 'string') text = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    text = value.toString();
  else if (typeof value === 'symbol') text = value.description ?? '';
  else if (typeof value === 'function') text = value.name;
  else text = JSON.stringify(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async sellerOverview(sellerId: string, query: AnalyticsQueryDto) {
    const period = this.period(query);
    return this.cached(
      `analytics:seller:${sellerId}:${period.from.toISOString()}:${period.to.toISOString()}`,
      async () => {
        const [
          money,
          completed,
          cancelled,
          products,
          auctions,
          daily,
          topProducts,
        ] = await Promise.all([
          this.money(period.from, period.to, sellerId),
          this.countSellerOrders(period.from, period.to, sellerId, 'DELIVERED'),
          this.countSellerOrders(period.from, period.to, sellerId, 'CANCELLED'),
          this.db.query<CountRow[]>(
            `SELECT COUNT(*)::text AS count FROM products WHERE "sellerProfileId"=$1 AND "isPublished"=true`,
            [sellerId],
          ),
          this.db.query<CountRow[]>(
            `SELECT COUNT(*)::text AS count FROM auctions a JOIN products p ON p.id=a."productId" WHERE p."sellerProfileId"=$1 AND a.status='ACTIVE'`,
            [sellerId],
          ),
          this.daily(period.from, period.to, sellerId),
          this.topProducts(period.from, period.to, sellerId),
        ]);
        return {
          period: this.periodView(period),
          summary: {
            grossSales: money.gross,
            commissionPaid: money.commission,
            netRevenue: money.net,
            refundTotal: money.refunds,
            sellerOrderCount: Number(money.orders),
            completedOrders: completed,
            cancelledOrders: cancelled,
            activeProducts: Number(products[0]?.count ?? 0),
            activeAuctions: Number(auctions[0]?.count ?? 0),
          },
          daily,
          topProducts,
        };
      },
    );
  }

  async adminReport(query: AnalyticsQueryDto) {
    const period = this.period(query);
    return this.cached(
      `analytics:admin:${period.from.toISOString()}:${period.to.toISOString()}`,
      async () => {
        const [
          current,
          previous,
          currentOrders,
          previousOrders,
          daily,
          sellers,
          topProducts,
          conversion,
        ] = await Promise.all([
          this.money(period.from, period.to),
          this.money(period.previousFrom, period.previousTo),
          this.countParentOrders(period.from, period.to),
          this.countParentOrders(period.previousFrom, period.previousTo),
          this.daily(period.from, period.to),
          this.sellerBreakdown(period.from, period.to),
          this.topProducts(period.from, period.to),
          this.conversion(period.from, period.to),
        ]);
        return {
          schemaVersion: '1.0',
          period: this.periodView(period),
          summary: {
            grossSales: current.gross,
            platformRevenue: current.commission,
            sellerNetRevenue: current.net,
            refunds: current.refunds,
            orders: currentOrders,
            conversionPercent: conversion,
          },
          comparison: {
            previousPlatformRevenue: previous.commission,
            platformRevenueChangePercent: percentageChange(
              Number(current.commission),
              Number(previous.commission),
            ),
            previousOrders,
            ordersChangePercent: percentageChange(
              currentOrders,
              previousOrders,
            ),
          },
          sellerBreakdown: sellers,
          topSellers: sellers.slice(0, 5),
          topProducts,
          dailySales: daily,
          conversionDefinition:
            'successful fixed-price checkouts divided by successful checkouts plus non-empty carts created in the selected period',
        };
      },
    );
  }

  async exportCsv(query: AnalyticsQueryDto): Promise<string> {
    const report = await this.adminReport(query);
    const rows: unknown[][] = [
      [
        'date',
        'orders',
        'gross_sales',
        'platform_commission',
        'refunds',
        'effective_seller_net',
      ],
      ...report.dailySales.map((d: Record<string, unknown>) => [
        d.date,
        d.orders,
        d.gross,
        d.commission,
        d.refunds,
        d.net,
      ]),
    ];
    return rows.map((row) => row.map(protectCsvValue).join(',')).join('\r\n');
  }

  private async money(
    from: Date,
    to: Date,
    sellerId?: string,
  ): Promise<MoneyRow> {
    const sellerClause = sellerId ? `AND le."sellerProfileId"=$3` : '';
    const params = sellerId ? [from, to, sellerId] : [from, to];
    const rows = await this.db.query<MoneyRow[]>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN le.type='SALE_CREDIT' THEN le.amount WHEN le.type='SELLER_EARNING_REVERSAL' THEN -le.amount ELSE 0 END),0)::numeric(12,2)::text AS gross,
        COALESCE(SUM(CASE WHEN le.type='COMMISSION_DEBIT' THEN le.amount WHEN le.type='PLATFORM_COMMISSION_REVERSAL' THEN -le.amount ELSE 0 END),0)::numeric(12,2)::text AS commission,
        COALESCE(SUM(CASE WHEN le.type='SALE_CREDIT' THEN le.amount WHEN le.type='COMMISSION_DEBIT' THEN -le.amount WHEN le.type='SELLER_EARNING_REVERSAL' THEN -le.amount WHEN le.type='PLATFORM_COMMISSION_REVERSAL' THEN le.amount ELSE 0 END),0)::numeric(12,2)::text AS net,
        COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN seller_orders so ON so.id=r."sellerOrderId" WHERE r.status='COMPLETED' AND r."createdAt">=$1 AND r."createdAt"<$2 ${sellerId ? 'AND so."sellerProfileId"=$3' : ''}),0)::numeric(12,2)::text AS refunds,
        COUNT(DISTINCT le."sellerOrderId")::text AS orders
      FROM ledger_entries le WHERE le."createdAt">=$1 AND le."createdAt"<$2 ${sellerClause}`,
      params,
    );
    return (
      rows[0] ?? {
        gross: '0.00',
        commission: '0.00',
        net: '0.00',
        refunds: '0.00',
        orders: '0',
      }
    );
  }

  private async countSellerOrders(
    from: Date,
    to: Date,
    sellerId: string,
    status: string,
  ): Promise<number> {
    const rows = await this.db.query<CountRow[]>(
      `SELECT COUNT(*)::text AS count FROM seller_orders WHERE "sellerProfileId"=$1 AND status=$2 AND "createdAt">=$3 AND "createdAt"<$4`,
      [sellerId, status, from, to],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async countParentOrders(from: Date, to: Date): Promise<number> {
    const rows = await this.db.query<CountRow[]>(
      `SELECT COUNT(*)::text AS count FROM orders WHERE "createdAt">=$1 AND "createdAt"<$2`,
      [from, to],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async daily(from: Date, to: Date, sellerId?: string) {
    const sellerClause = sellerId ? `AND le."sellerProfileId"=$3` : '';
    const refundSellerClause = sellerId ? `AND so."sellerProfileId"=$3` : '';
    return this.db.query<Record<string, unknown>[]>(
      `WITH ledger_daily AS (
        SELECT DATE_TRUNC('day',le."createdAt") AS bucket, COUNT(DISTINCT ${sellerId ? 'le."sellerOrderId"' : 'so."orderId"'})::int orders,
        SUM(CASE WHEN le.type='SALE_CREDIT' THEN le.amount WHEN le.type='SELLER_EARNING_REVERSAL' THEN -le.amount ELSE 0 END) gross,
        SUM(CASE WHEN le.type='COMMISSION_DEBIT' THEN le.amount WHEN le.type='PLATFORM_COMMISSION_REVERSAL' THEN -le.amount ELSE 0 END) commission,
        SUM(CASE WHEN le.type='SALE_CREDIT' THEN le.amount WHEN le.type='COMMISSION_DEBIT' THEN -le.amount WHEN le.type='SELLER_EARNING_REVERSAL' THEN -le.amount WHEN le.type='PLATFORM_COMMISSION_REVERSAL' THEN le.amount ELSE 0 END) net
        FROM ledger_entries le JOIN seller_orders so ON so.id=le."sellerOrderId" WHERE le."createdAt">=$1 AND le."createdAt"<$2 ${sellerClause} GROUP BY DATE_TRUNC('day',le."createdAt")
      ), refund_daily AS (
        SELECT DATE_TRUNC('day',r."createdAt") AS bucket,SUM(r.amount) refunds FROM refunds r JOIN seller_orders so ON so.id=r."sellerOrderId" WHERE r.status='COMPLETED' AND r."createdAt">=$1 AND r."createdAt"<$2 ${refundSellerClause} GROUP BY DATE_TRUNC('day',r."createdAt")
      ) SELECT TO_CHAR(COALESCE(l.bucket,r.bucket),'YYYY-MM-DD') date,COALESCE(l.orders,0)::int orders,COALESCE(l.gross,0)::numeric(12,2)::text gross,COALESCE(l.commission,0)::numeric(12,2)::text commission,COALESCE(l.net,0)::numeric(12,2)::text net,COALESCE(r.refunds,0)::numeric(12,2)::text refunds FROM ledger_daily l FULL OUTER JOIN refund_daily r ON r.bucket=l.bucket ORDER BY COALESCE(l.bucket,r.bucket)`,
      sellerId ? [from, to, sellerId] : [from, to],
    );
  }

  private async sellerBreakdown(from: Date, to: Date) {
    return this.db.query<Record<string, unknown>[]>(
      `SELECT sp.id AS "sellerId", sp."storeName",
      COALESCE(SUM(CASE WHEN le.type='SALE_CREDIT' THEN le.amount WHEN le.type='SELLER_EARNING_REVERSAL' THEN -le.amount ELSE 0 END),0)::numeric(12,2)::text AS gross,
      COALESCE(SUM(CASE WHEN le.type='COMMISSION_DEBIT' THEN le.amount WHEN le.type='PLATFORM_COMMISSION_REVERSAL' THEN -le.amount ELSE 0 END),0)::numeric(12,2)::text AS commission,
      COALESCE(SUM(CASE WHEN le.type='SALE_CREDIT' THEN le.amount WHEN le.type='COMMISSION_DEBIT' THEN -le.amount WHEN le.type='SELLER_EARNING_REVERSAL' THEN -le.amount WHEN le.type='PLATFORM_COMMISSION_REVERSAL' THEN le.amount ELSE 0 END),0)::numeric(12,2)::text AS net
      FROM seller_profiles sp JOIN ledger_entries le ON le."sellerProfileId"=sp.id WHERE le."createdAt">=$1 AND le."createdAt"<$2 GROUP BY sp.id,sp."storeName" ORDER BY SUM(CASE WHEN le.type='SALE_CREDIT' THEN le.amount WHEN le.type='COMMISSION_DEBIT' THEN -le.amount WHEN le.type='SELLER_EARNING_REVERSAL' THEN -le.amount WHEN le.type='PLATFORM_COMMISSION_REVERSAL' THEN le.amount ELSE 0 END) DESC LIMIT 100`,
      [from, to],
    );
  }

  private async topProducts(from: Date, to: Date, sellerId?: string) {
    return this.db.query<Record<string, unknown>[]>(
      `SELECT soi."productId", soi."productName", SUM(soi.quantity-COALESCE(rr.qty,0))::int AS quantity,
      COALESCE(SUM(soi."lineTotal"-COALESCE(rr.amount,0)),0)::numeric(12,2)::text AS sales
      FROM seller_order_items soi JOIN seller_orders so ON so.id=soi."sellerOrderId"
      LEFT JOIN (SELECT "sellerOrderItemId",SUM(quantity) qty,SUM(amount) amount FROM refunds WHERE status='COMPLETED' GROUP BY "sellerOrderItemId") rr ON rr."sellerOrderItemId"=soi.id
      WHERE so.status='DELIVERED' AND so."createdAt">=$1 AND so."createdAt"<$2 ${sellerId ? 'AND so."sellerProfileId"=$3' : ''}
      GROUP BY soi."productId",soi."productName" ORDER BY SUM(soi."lineTotal"-COALESCE(rr.amount,0)) DESC LIMIT 5`,
      sellerId ? [from, to, sellerId] : [from, to],
    );
  }

  private async conversion(from: Date, to: Date): Promise<number | null> {
    const rows = await this.db.query<
      { checkouts: string; abandoned: string }[]
    >(
      `SELECT
      (SELECT COUNT(*) FROM checkout_idempotency_keys WHERE status='COMPLETED' AND "createdAt">=$1 AND "createdAt"<$2)::text AS checkouts,
      (SELECT COUNT(DISTINCT c.id) FROM carts c JOIN cart_items ci ON ci."cartId"=c.id WHERE c."createdAt">=$1 AND c."createdAt"<$2)::text AS abandoned`,
      [from, to],
    );
    const successful = Number(rows[0]?.checkouts ?? 0);
    const abandoned = Number(rows[0]?.abandoned ?? 0);
    return successful + abandoned === 0
      ? null
      : Number(((successful / (successful + abandoned)) * 100).toFixed(2));
  }

  private period(query: AnalyticsQueryDto): Period {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    if (from >= to)
      throw new BadRequestException('Analytics from date must precede to date');
    const span = to.getTime() - from.getTime();
    return {
      from,
      to,
      previousFrom: new Date(from.getTime() - span),
      previousTo: from,
    };
  }
  private periodView(p: Period) {
    return {
      from: p.from.toISOString(),
      to: p.to.toISOString(),
      previousFrom: p.previousFrom.toISOString(),
      previousTo: p.previousTo.toISOString(),
    };
  }
  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    try {
      const value = await this.redis.get(key);
      if (value) return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(
        `analytics cache read failed: ${(error as Error).message}`,
      );
    }
    const value = await load();
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        `analytics cache write failed: ${(error as Error).message}`,
      );
    }
    return value;
  }
}
