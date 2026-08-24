/* eslint-disable @typescript-eslint/no-unsafe-return -- jest.fn() mock typing */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductType } from '../products/entities/product-type.enum';

function fixedPriceProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    sellerProfileId: 'seller-1',
    sellerProfile: { id: 'seller-1', storeName: 'Store One' },
    name: 'Widget',
    price: '10.00',
    stockQuantity: 5,
    isPublished: true,
    type: ProductType.FIXED_PRICE,
    imageUrls: [],
    ...overrides,
  } as unknown as Product;
}

describe('CartService', () => {
  let service: CartService;
  let cartsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let cartItemsRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    insert: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let productsRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    cartsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'cart-1', userId: 'user-1' }),
      create: jest.fn((x) => x),
      save: jest.fn((x) => x),
    };
    cartItemsRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      insert: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    productsRepository = { findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Cart), useValue: cartsRepository },
        {
          provide: getRepositoryToken(CartItem),
          useValue: cartItemsRepository,
        },
        { provide: getRepositoryToken(Product), useValue: productsRepository },
      ],
    }).compile();

    service = moduleRef.get(CartService);
  });

  describe('getCartView — seller grouping', () => {
    it('groups cart items by seller, computing per-seller and overall totals', async () => {
      const productA = fixedPriceProduct({
        id: 'product-a',
        sellerProfileId: 'seller-a',
        sellerProfile: { id: 'seller-a', storeName: 'Store A' } as never,
        name: 'Gadget A',
        price: '10.00',
      });
      const productB = fixedPriceProduct({
        id: 'product-b',
        sellerProfileId: 'seller-b',
        sellerProfile: { id: 'seller-b', storeName: 'Store B' } as never,
        name: 'Gadget B',
        price: '5.50',
      });

      cartItemsRepository.find.mockResolvedValue([
        { productId: 'product-a', quantity: 2, product: productA },
        { productId: 'product-b', quantity: 3, product: productB },
      ]);

      const view = await service.getCartView('user-1');

      expect(view.sellers).toHaveLength(2);
      const groupA = view.sellers.find(
        (g) => g.sellerProfileId === 'seller-a',
      )!;
      const groupB = view.sellers.find(
        (g) => g.sellerProfileId === 'seller-b',
      )!;
      expect(groupA.subtotal).toBe('20.00');
      expect(groupB.subtotal).toBe('16.50');
      expect(view.totalAmount).toBe('36.50');
      expect(view.itemCount).toBe(5);
    });

    it('silently drops items whose product became unavailable since being added', async () => {
      const stillAvailable = fixedPriceProduct({ id: 'product-a' });
      const nowUnpublished = fixedPriceProduct({
        id: 'product-b',
        isPublished: false,
      });

      cartItemsRepository.find.mockResolvedValue([
        { productId: 'product-a', quantity: 1, product: stillAvailable },
        { productId: 'product-b', quantity: 1, product: nowUnpublished },
      ]);

      const view = await service.getCartView('user-1');
      expect(view.sellers).toHaveLength(1);
      expect(view.sellers[0].items).toHaveLength(1);
    });
  });

  describe('addItem — purchasability guards', () => {
    it('rejects an auction product', async () => {
      productsRepository.findOne.mockResolvedValue(
        fixedPriceProduct({ type: ProductType.AUCTION, price: null }),
      );
      await expect(
        service.addItem('user-1', 'product-1', 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unpublished (or nonexistent) product', async () => {
      productsRepository.findOne.mockResolvedValue(null);
      await expect(
        service.addItem('user-1', 'product-1', 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a quantity exceeding current stock', async () => {
      productsRepository.findOne.mockResolvedValue(
        fixedPriceProduct({ stockQuantity: 2 }),
      );
      cartItemsRepository.findOne.mockResolvedValue(null);
      await expect(
        service.addItem('user-1', 'product-1', 3),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('increments quantity when the product is already in the cart', async () => {
      productsRepository.findOne.mockResolvedValue(
        fixedPriceProduct({ stockQuantity: 10 }),
      );
      cartItemsRepository.findOne.mockResolvedValue({
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 2,
      });

      await service.addItem('user-1', 'product-1', 3);

      expect(cartItemsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 5 }),
      );
      expect(cartItemsRepository.insert).not.toHaveBeenCalled();
    });
  });
});
