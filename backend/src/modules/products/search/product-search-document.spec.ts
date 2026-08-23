import { buildProductSearchDocument } from './product-search-document';
import { ProductType } from '../entities/product-type.enum';
import type { Product } from '../entities/product.entity';

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    sellerProfileId: 'seller-1',
    sellerProfile: { storeName: "Jane's Shop" },
    categoryId: 'category-1',
    category: { name: 'Electronics' },
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    description: 'Great sound.',
    type: ProductType.FIXED_PRICE,
    price: '49.99',
    stockQuantity: 5,
    imageUrls: ['https://example.com/a.jpg'],
    isPublished: true,
    ratingAverage: '4.50',
    ratingCount: 12,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as Product;
}

describe('buildProductSearchDocument', () => {
  it('maps a published product to a flat, public-safe search document', () => {
    const doc = buildProductSearchDocument(buildProduct());

    expect(doc).toEqual(
      expect.objectContaining({
        id: 'product-1',
        sellerId: 'seller-1',
        sellerName: "Jane's Shop",
        categoryId: 'category-1',
        categoryName: 'Electronics',
        price: 49.99,
        rating: 4.5,
        ratingCount: 12,
        available: true,
        productType: 'FIXED_PRICE',
        createdAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
      }),
    );
  });

  it('never leaks seller-private fields like commission rate or internal ids', () => {
    const doc = buildProductSearchDocument(buildProduct());
    const keys = Object.keys(doc);
    expect(keys).not.toContain('commissionRatePercent');
    expect(keys).not.toContain('userId');
  });

  it('marks a zero-stock product as unavailable', () => {
    const doc = buildProductSearchDocument(buildProduct({ stockQuantity: 0 }));
    expect(doc.available).toBe(false);
  });

  it('represents an unpriced auction product as a null price', () => {
    const doc = buildProductSearchDocument(
      buildProduct({ type: ProductType.AUCTION, price: null }),
    );
    expect(doc.price).toBeNull();
  });
});
