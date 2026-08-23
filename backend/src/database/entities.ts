import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { AuthIdentity } from '../modules/auth/entities/auth-identity.entity';
import { SellerProfile } from '../modules/sellers/entities/seller-profile.entity';
import { SellerApplication } from '../modules/sellers/entities/seller-application.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Product } from '../modules/products/entities/product.entity';
import { Cart } from '../modules/cart/entities/cart.entity';
import { CartItem } from '../modules/cart/entities/cart-item.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { SellerOrder } from '../modules/orders/entities/seller-order.entity';
import { SellerOrderItem } from '../modules/orders/entities/seller-order-item.entity';
import { Auction } from '../modules/bidding/entities/auction.entity';
import { Bid } from '../modules/bidding/entities/bid.entity';
import { LedgerEntry } from '../modules/payments-ledger/entities/ledger-entry.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { Dispute } from '../modules/disputes/entities/dispute.entity';
import { Refund } from '../modules/disputes/entities/refund.entity';
import { OutboxEvent } from '../modules/outbox/entities/outbox-event.entity';
import { ProcessedEvent } from '../modules/outbox/entities/processed-event.entity';

/**
 * Single source of truth for the entity list, shared by the runtime
 * TypeOrmModule config and the CLI DataSource used for migrations — keeps
 * the two from drifting apart.
 */
export const ALL_ENTITIES = [
  User,
  RefreshToken,
  AuthIdentity,
  SellerProfile,
  SellerApplication,
  Category,
  Product,
  Cart,
  CartItem,
  Order,
  SellerOrder,
  SellerOrderItem,
  Auction,
  Bid,
  LedgerEntry,
  Review,
  Dispute,
  Refund,
  OutboxEvent,
  ProcessedEvent,
];
