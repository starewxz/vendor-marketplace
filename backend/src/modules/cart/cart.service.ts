import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductType } from '../products/entities/product-type.enum';
import { isUniqueViolation } from '../../common/utils/slug';
import {
  formatCentsToMoney,
  multiplyCentsByQuantity,
  parseMoneyToCents,
  sumCents,
} from '../../common/utils/money';
import { CartItemView, CartSellerGroup, CartView } from './dto/cart-view';

const ITEM_RELATIONS = { product: { sellerProfile: true } } as const;

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartsRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemsRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async getCartView(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    return this.buildView(cart.id);
  }

  async addItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    const product = await this.getPurchasableProduct(productId);

    const existing = await this.cartItemsRepository.findOne({
      where: { cartId: cart.id, productId },
    });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    this.assertWithinStock(product, nextQuantity);

    if (existing) {
      existing.quantity = nextQuantity;
      await this.cartItemsRepository.save(existing);
    } else {
      try {
        await this.cartItemsRepository.insert({
          cartId: cart.id,
          productId,
          quantity: nextQuantity,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Concurrent add of the same product raced us — retry as an
          // increment on the row the other request just inserted.
          return this.addItem(userId, productId, quantity);
        }
        throw error;
      }
    }

    return this.buildView(cart.id);
  }

  async updateItemQuantity(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.cartItemsRepository.findOne({
      where: { cartId: cart.id, productId },
    });
    if (!item) {
      throw new NotFoundException('Product is not in your cart');
    }

    const product = await this.getPurchasableProduct(productId);
    this.assertWithinStock(product, quantity);

    item.quantity = quantity;
    await this.cartItemsRepository.save(item);
    return this.buildView(cart.id);
  }

  async removeItem(userId: string, productId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemsRepository.delete({ cartId: cart.id, productId });
    return this.buildView(cart.id);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    await this.cartItemsRepository.delete({ cartId: cart.id });
    return this.buildView(cart.id);
  }

  // -----------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------

  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing = await this.cartsRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }
    try {
      return await this.cartsRepository.save(
        this.cartsRepository.create({ userId }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Concurrent first-access race — the other request already
        // created the cart, so just read it back.
        const cart = await this.cartsRepository.findOne({ where: { userId } });
        if (cart) {
          return cart;
        }
      }
      throw error;
    }
  }

  private async getPurchasableProduct(productId: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });
    if (!product || !product.isPublished) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (product.type !== ProductType.FIXED_PRICE || product.price === null) {
      throw new BadRequestException(
        'Auction products cannot be added to the cart',
      );
    }
    return product;
  }

  private assertWithinStock(product: Product, requestedQuantity: number): void {
    if (requestedQuantity > product.stockQuantity) {
      throw new ConflictException(
        `Only ${product.stockQuantity} unit(s) of "${product.name}" are available`,
      );
    }
  }

  private async buildView(cartId: string): Promise<CartView> {
    const items = await this.cartItemsRepository.find({
      where: { cartId },
      relations: ITEM_RELATIONS,
      order: { createdAt: 'ASC' },
    });

    // A product can be deleted/unpublished after being added to a cart —
    // rather than erroring the whole cart read, drop it from the view
    // silently. It's cleaned up for real the next time the customer
    // mutates the cart (checkout re-validates from scratch regardless).
    const purchasable = items.filter(
      (item) =>
        item.product &&
        item.product.isPublished &&
        item.product.type === ProductType.FIXED_PRICE &&
        item.product.price !== null,
    );

    const groups = new Map<string, CartSellerGroup>();
    for (const item of purchasable) {
      const product = item.product;
      const sellerProfileId = product.sellerProfileId;
      let group = groups.get(sellerProfileId);
      if (!group) {
        group = {
          sellerProfileId,
          storeName: product.sellerProfile.storeName,
          items: [],
          subtotal: '0.00',
        };
        groups.set(sellerProfileId, group);
      }

      const unitPriceCents = parseMoneyToCents(product.price as string);
      const lineTotalCents = multiplyCentsByQuantity(
        unitPriceCents,
        item.quantity,
      );
      const itemView: CartItemView = {
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrls[0] ?? null,
        unitPrice: product.price as string,
        quantity: item.quantity,
        lineTotal: formatCentsToMoney(lineTotalCents),
        availableStock: product.stockQuantity,
      };
      group.items.push(itemView);
    }

    const sellers = Array.from(groups.values()).map((group) => ({
      ...group,
      subtotal: formatCentsToMoney(
        sumCents(group.items.map((item) => parseMoneyToCents(item.lineTotal))),
      ),
    }));

    const itemCount = sellers.reduce(
      (count, group) =>
        count + group.items.reduce((sum, item) => sum + item.quantity, 0),
      0,
    );
    const totalAmount = formatCentsToMoney(
      sumCents(sellers.map((group) => parseMoneyToCents(group.subtotal))),
    );

    return { sellers, itemCount, totalAmount };
  }
}
