import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { SeedDemoCatalogModule } from './seed-demo-catalog.module';
import { Product } from '../modules/products/entities/product.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { SellerProfile } from '../modules/sellers/entities/seller-profile.entity';
import { Auction } from '../modules/bidding/entities/auction.entity';
import { AuctionStatus } from '../modules/bidding/entities/auction-status.enum';
import { ProductType } from '../modules/products/entities/product-type.enum';
import { User } from '../modules/users/entities/user.entity';
import { UserRole } from '../modules/users/entities/user-role.enum';
import { generateUniqueSlug } from '../common/utils/slug';

const BCRYPT_SALT_ROUNDS = 12;
const DEMO_SELLER_STORE_NAME = 'Demo Goods';
const DEMO_SELLER_STORE_SLUG = 'demo-goods';
const DEMO_SELLER_EMAIL =
  process.env.DEMO_SELLER_EMAIL ?? 'demo-seller@example.com';
const DEMO_SELLER_PASSWORD =
  process.env.DEMO_SELLER_PASSWORD ?? 'DemoSeller123!';
const DEMO_CATEGORY_NAMES = [
  'Electronics',
  'Fashion',
  'Home',
  'Beauty',
  'Gaming',
  'Sports',
  'Books',
  'Toys',
];
const DAY_MS = 24 * 60 * 60 * 1000;

interface FixedPricePlan {
  category: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
}

interface AuctionPlan {
  category: string;
  name: string;
  description: string;
  startPrice: number;
  minBidIncrement: number;
  endsInDays: number;
}

/**
 * Every name below intentionally contains the literal keyword that
 * frontend/src/lib/productImages.ts matches on (e.g. "Smartphone",
 * "Sneakers", "Console") so the resolved demo image is never a guess —
 * see the task's image-consistency audit for the full name -> image
 * mapping this guarantees.
 */
const FIXED_PRICE_PLAN: FixedPricePlan[] = [
  // --- Electronics ---
  {
    category: 'Electronics',
    name: 'Samsung Galaxy S24 Smartphone — 128GB Onyx Black',
    description:
      'Android smartphone with a 6.2" Dynamic AMOLED display, triple rear camera, and all-day battery life.',
    price: 799,
    stockQuantity: 25,
  },
  {
    category: 'Electronics',
    name: 'Apple MacBook Air M3 13" Laptop — 16GB/512GB',
    description:
      'Fanless M3 laptop in Midnight, 13.6" Liquid Retina display, up to 18 hours of battery life.',
    price: 1299,
    stockQuantity: 10,
  },
  {
    category: 'Electronics',
    name: 'Logitech G Pro Wireless Gaming Mouse',
    description:
      'Lightweight wireless gaming mouse with a HERO 25K sensor and up to 60 hours of battery life.',
    price: 129,
    stockQuantity: 40,
  },
  {
    category: 'Electronics',
    name: 'Anker Soundcore Portable Bluetooth Speaker',
    description:
      'Compact waterproof Bluetooth speaker with 24-hour playtime and punchy bass for on-the-go listening.',
    price: 59,
    stockQuantity: 60,
  },
  {
    category: 'Electronics',
    name: 'Samsung 27" 4K Monitor',
    description:
      '27-inch 4K UHD monitor with HDR10 support and a slim bezel design, ideal for work and creative use.',
    price: 349,
    stockQuantity: 15,
  },
  {
    category: 'Electronics',
    name: 'Apple AirPods Pro Earbuds (2nd Gen)',
    description:
      'In-ear wireless earbuds with active noise cancellation, adaptive audio, and a USB-C charging case.',
    price: 249,
    stockQuantity: 35,
  },
  {
    category: 'Electronics',
    name: 'Amazon Kindle Paperwhite E-Reader',
    description:
      'Waterproof e-reader with a 6.8" glare-free display and weeks of battery life on a single charge.',
    price: 139,
    stockQuantity: 50,
  },

  // --- Fashion ---
  {
    category: 'Fashion',
    name: 'Ray-Ban Aviator Sunglasses',
    description:
      'Classic metal-frame aviator sunglasses with polarized lenses and 100% UV protection.',
    price: 159,
    stockQuantity: 30,
  },
  {
    category: 'Fashion',
    name: 'Classic Fit Straight Jeans',
    description:
      'Mid-rise straight-leg jeans in durable stretch denim, machine washable.',
    price: 49,
    stockQuantity: 45,
  },
  {
    category: 'Fashion',
    name: 'Organic Cotton Crew-Neck T-Shirt (3-Pack)',
    description:
      'Soft, breathable 100% organic cotton tees in a versatile 3-pack, pre-shrunk fit.',
    price: 29,
    stockQuantity: 80,
  },
  {
    category: 'Fashion',
    name: 'Sterling Silver Pendant Necklace',
    description:
      'Hand-finished sterling silver necklace with a minimalist pendant, hypoallergenic clasp.',
    price: 65,
    stockQuantity: 20,
  },
  {
    category: 'Fashion',
    name: 'Canvas Tote Handbag',
    description:
      'Durable heavyweight canvas tote with interior pockets and reinforced leather handles.',
    price: 39,
    stockQuantity: 25,
  },

  // --- Home ---
  {
    category: 'Home',
    name: 'Non-Stick Cookware Set (10-Piece)',
    description:
      'Aluminum non-stick cookware set including pots, pans, and lids — dishwasher safe.',
    price: 149,
    stockQuantity: 12,
  },
  {
    category: 'Home',
    name: 'Robot Vacuum Cleaner',
    description:
      'Self-charging robot vacuum with smart mapping and app-controlled scheduling for daily cleaning.',
    price: 299,
    stockQuantity: 8,
  },
  {
    category: 'Home',
    name: 'Cotton Duvet Cover Bedding Set (Queen)',
    description:
      '100% cotton duvet cover set with two pillowcases, breathable and machine washable.',
    price: 79,
    stockQuantity: 18,
  },
  {
    category: 'Home',
    name: 'Fiddle Leaf Fig Artificial Plant',
    description:
      'Lifelike artificial plant in a woven planter, no watering or sunlight required.',
    price: 45,
    stockQuantity: 22,
  },
  {
    category: 'Home',
    name: 'Ceramic Vase Home Decor Set',
    description:
      'Set of three matte-glazed ceramic vases in varying heights, a simple shelf or table accent.',
    price: 35,
    stockQuantity: 30,
  },

  // --- Beauty ---
  {
    category: 'Beauty',
    name: 'Matte Lipstick Set (6 Shades)',
    description:
      'Long-wearing matte lipstick set in six everyday shades, cruelty-free formula.',
    price: 32,
    stockQuantity: 40,
  },
  {
    category: 'Beauty',
    name: 'Amber & Oud Eau de Parfum Fragrance',
    description:
      'Warm, woody eau de parfum with amber and oud notes, long-lasting throw.',
    price: 78,
    stockQuantity: 25,
  },
  {
    category: 'Beauty',
    name: 'Sulfate-Free Shampoo & Conditioner Duo',
    description:
      'Gentle sulfate-free hair care duo formulated for color-treated hair.',
    price: 24,
    stockQuantity: 50,
  },

  // --- Gaming ---
  {
    category: 'Gaming',
    name: 'Razer BlackShark Gaming Headset',
    description:
      'Lightweight over-ear gaming headset with a detachable mic and immersive 7.1 surround sound.',
    price: 99,
    stockQuantity: 20,
  },
  {
    category: 'Gaming',
    name: 'Xbox Wireless Controller',
    description:
      'Official wireless controller with textured grip and a hybrid D-pad, compatible with PC and console.',
    price: 64,
    stockQuantity: 30,
  },
  {
    category: 'Gaming',
    name: '165Hz Curved Gaming Monitor 27"',
    description:
      '27-inch curved gaming monitor with a 165Hz refresh rate and 1ms response time.',
    price: 279,
    stockQuantity: 10,
  },

  // --- Sports ---
  {
    category: 'Sports',
    name: 'Premium Yoga Mat with Carry Strap',
    description:
      'Extra-thick non-slip yoga mat with a lightweight carry strap, ideal for studio or home practice.',
    price: 39,
    stockQuantity: 40,
  },
  {
    category: 'Sports',
    name: 'Adjustable Dumbbell Set (5-25 lbs)',
    description:
      'Space-saving adjustable dumbbell pair with quick-turn weight selection.',
    price: 189,
    stockQuantity: 10,
  },
  {
    category: 'Sports',
    name: 'Mountain Bicycle, 21-Speed',
    description:
      'All-terrain mountain bicycle with a lightweight aluminum frame and front suspension fork.',
    price: 449,
    stockQuantity: 5,
  },
  {
    category: 'Sports',
    name: 'Official Size Basketball',
    description:
      'Indoor/outdoor composite-leather basketball, official size and weight.',
    price: 25,
    stockQuantity: 60,
  },
  {
    category: 'Sports',
    name: '2-Person Camping Tent, Waterproof',
    description:
      'Lightweight two-person tent with a waterproof rainfly, sets up in under five minutes.',
    price: 129,
    stockQuantity: 15,
  },

  // --- Books ---
  {
    category: 'Books',
    name: 'The Art of Home Cooking — Hardcover Cookbook',
    description:
      'A hardcover cookbook of approachable, everyday recipes with step-by-step photography.',
    price: 34,
    stockQuantity: 30,
  },
  {
    category: 'Books',
    name: "Illustrated Children's Storybook, Hardcover",
    description:
      'A beautifully illustrated hardcover storybook for young readers, ages 4-8.',
    price: 19,
    stockQuantity: 35,
  },
  {
    category: 'Books',
    name: 'Bestselling Mystery Paperback Series (3-Book Set)',
    description:
      'A gripping 3-book paperback mystery series, boxed set edition.',
    price: 42,
    stockQuantity: 20,
  },

  // --- Toys ---
  {
    category: 'Toys',
    name: 'Wooden Building Blocks Set (100 Pieces)',
    description:
      'Natural wooden building block set in a storage box, safe for ages 3 and up.',
    price: 42,
    stockQuantity: 25,
  },
  {
    category: 'Toys',
    name: 'Classic Strategy Board Game',
    description:
      'A classic strategy board game for 2-4 players, family game night staple.',
    price: 38,
    stockQuantity: 20,
  },
  {
    category: 'Toys',
    name: 'Giant Plush Teddy Bear, 24"',
    description:
      'An oversized, ultra-soft plush teddy bear — a huggable gift for any age.',
    price: 34,
    stockQuantity: 15,
  },
];

const AUCTION_PLAN: AuctionPlan[] = [
  {
    category: 'Electronics',
    name: 'Apple iPhone 14 Pro 256GB Smartphone — Space Black',
    description:
      'Auction listing: a well-maintained Apple iPhone 14 Pro, 256GB, Space Black, with A16 Bionic chip and 48MP camera.',
    startPrice: 650,
    minBidIncrement: 20,
    endsInDays: 2,
  },
  {
    category: 'Gaming',
    name: 'Sony PlayStation 5 Slim Console — Disc Edition',
    description:
      'Auction listing: Sony PlayStation 5 Slim console, disc edition, includes one wireless controller.',
    startPrice: 350,
    minBidIncrement: 15,
    endsInDays: 3,
  },
  {
    category: 'Electronics',
    name: 'Sony WH-1000XM5 Wireless Headphones',
    description:
      'Auction listing: Sony WH-1000XM5 over-ear wireless headphones with industry-leading noise cancellation.',
    startPrice: 180,
    minBidIncrement: 10,
    endsInDays: 1,
  },
  {
    category: 'Electronics',
    name: 'Fujifilm X-T30 II Mirrorless Camera',
    description:
      'Auction listing: Fujifilm X-T30 II mirrorless camera body, lightly used, with 26.1MP APS-C sensor.',
    startPrice: 550,
    minBidIncrement: 25,
    endsInDays: 4,
  },
  {
    category: 'Fashion',
    name: 'Nike Air Jordan 1 Retro High Sneakers — Chicago',
    description:
      'Auction listing: Nike Air Jordan 1 Retro High sneakers in the Chicago colorway, deadstock condition.',
    startPrice: 220,
    minBidIncrement: 15,
    endsInDays: 2,
  },
  {
    category: 'Gaming',
    name: 'Nintendo Switch OLED Console — Zelda Edition',
    description:
      'Auction listing: Nintendo Switch OLED console, Zelda limited edition, includes dock and Joy-Cons.',
    startPrice: 240,
    minBidIncrement: 10,
    endsInDays: 3,
  },
  {
    category: 'Toys',
    name: 'LEGO Star Wars Millennium Falcon Collector Set',
    description:
      'Auction listing: LEGO Star Wars Millennium Falcon collector set, factory sealed box.',
    startPrice: 480,
    minBidIncrement: 20,
    endsInDays: 5,
  },
  {
    category: 'Electronics',
    name: 'Marshall Stanmore III Bluetooth Speaker',
    description:
      'Auction listing: Marshall Stanmore III Bluetooth speaker in classic black, retro styling with modern drivers.',
    startPrice: 200,
    minBidIncrement: 10,
    endsInDays: 2,
  },
];

/** Legacy product names that already exist and just need reactivating with
 * realistic pricing rather than duplicated — see script output. */
const REACTIVATE_AUCTIONS: Array<{
  name: string;
  startPrice: number;
  minBidIncrement: number;
  endsInDays: number;
}> = [
  {
    name: 'Vintage Film Camera',
    startPrice: 180,
    minBidIncrement: 10,
    endsInDays: 3,
  },
  {
    name: 'Chronograph Watch',
    startPrice: 220,
    minBidIncrement: 10,
    endsInDays: 2,
  },
  {
    name: 'Retro Gaming Console',
    startPrice: 120,
    minBidIncrement: 10,
    endsInDays: 4,
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(
    SeedDemoCatalogModule,
    {
      logger: ['error', 'warn'],
    },
  );

  try {
    const products = app.get<Repository<Product>>(getRepositoryToken(Product));
    const categories = app.get<Repository<Category>>(
      getRepositoryToken(Category),
    );
    const sellerProfiles = app.get<Repository<SellerProfile>>(
      getRepositoryToken(SellerProfile),
    );
    const auctions = app.get<Repository<Auction>>(getRepositoryToken(Auction));
    const users = app.get<Repository<User>>(getRepositoryToken(User));

    // Idempotent bootstrap, same pattern as seed-admin.ts: find-or-create
    // the demo seller (User + approved SellerProfile) and demo categories
    // rather than requiring them to already exist. A clean database can
    // run `npm run seed:demo` on its own.
    let demoUser = await users.findOne({
      where: { email: DEMO_SELLER_EMAIL },
    });
    if (!demoUser) {
      const passwordHash = await bcrypt.hash(
        DEMO_SELLER_PASSWORD,
        BCRYPT_SALT_ROUNDS,
      );
      demoUser = await users.save(
        users.create({
          email: DEMO_SELLER_EMAIL,
          passwordHash,
          firstName: 'Demo',
          lastName: 'Seller',
          role: UserRole.SELLER,
          isEmailVerified: true,
        }),
      );
      console.log(`Demo seller account created: ${DEMO_SELLER_EMAIL}`);
    }

    let seller = await sellerProfiles.findOne({
      where: { storeName: DEMO_SELLER_STORE_NAME },
    });
    if (!seller) {
      seller = await sellerProfiles.save(
        sellerProfiles.create({
          userId: demoUser.id,
          storeName: DEMO_SELLER_STORE_NAME,
          storeSlug: DEMO_SELLER_STORE_SLUG,
          description: 'Curated demo storefront for the marketplace catalog.',
          isActive: true,
        }),
      );
      console.log(`Seller profile "${DEMO_SELLER_STORE_NAME}" created.`);
    }

    const categoryByShortName = new Map<string, Category>();
    for (const shortName of DEMO_CATEGORY_NAMES) {
      let category = await categories.findOne({
        where: { name: shortName },
      });
      if (!category) {
        const slug = await generateUniqueSlug(shortName, (candidate) =>
          categories.exists({ where: { slug: candidate } }),
        );
        category = await categories.save(
          categories.create({ name: shortName, slug, isActive: true }),
        );
        console.log(`Category "${shortName}" created.`);
      }
      categoryByShortName.set(shortName, category);
    }

    let createdFixed = 0;
    let skippedFixed = 0;
    for (const plan of FIXED_PRICE_PLAN) {
      const exists = await products.exists({
        where: { name: plan.name, sellerProfileId: seller.id },
      });
      if (exists) {
        skippedFixed += 1;
        continue;
      }
      const category = categoryByShortName.get(plan.category)!;
      const slug = await generateUniqueSlug(plan.name, (candidate) =>
        products.exists({ where: { slug: candidate } }),
      );
      await products.save(
        products.create({
          sellerProfileId: seller.id,
          categoryId: category.id,
          name: plan.name,
          slug,
          description: plan.description,
          type: ProductType.FIXED_PRICE,
          price: plan.price.toFixed(2),
          stockQuantity: plan.stockQuantity,
          imageUrls: [],
          isPublished: true,
        }),
      );
      createdFixed += 1;
    }
    console.log(
      `Fixed-price products: ${createdFixed} created, ${skippedFixed} already existed.`,
    );

    let createdAuctions = 0;
    let skippedAuctions = 0;
    const now = Date.now();
    for (const plan of AUCTION_PLAN) {
      const exists = await products.exists({
        where: { name: plan.name, sellerProfileId: seller.id },
      });
      if (exists) {
        skippedAuctions += 1;
        continue;
      }
      const category = categoryByShortName.get(plan.category)!;
      const slug = await generateUniqueSlug(plan.name, (candidate) =>
        products.exists({ where: { slug: candidate } }),
      );
      const product = await products.save(
        products.create({
          sellerProfileId: seller.id,
          categoryId: category.id,
          name: plan.name,
          slug,
          description: plan.description,
          type: ProductType.AUCTION,
          price: null,
          stockQuantity: 1,
          imageUrls: [],
          isPublished: true,
        }),
      );
      await auctions.save(
        auctions.create({
          productId: product.id,
          startPrice: plan.startPrice.toFixed(2),
          currentPrice: plan.startPrice.toFixed(2),
          minBidIncrement: plan.minBidIncrement.toFixed(2),
          startsAt: new Date(now),
          endsAt: new Date(now + plan.endsInDays * DAY_MS),
          status: AuctionStatus.ACTIVE,
        }),
      );
      createdAuctions += 1;
    }
    console.log(
      `Auction products: ${createdAuctions} created, ${skippedAuctions} already existed.`,
    );

    let reactivated = 0;
    for (const plan of REACTIVATE_AUCTIONS) {
      const product = await products.findOne({
        where: { name: plan.name, sellerProfileId: seller.id },
      });
      if (!product) continue;
      const auction = await auctions.findOne({
        where: { productId: product.id },
      });
      if (!auction) continue;
      auction.status = AuctionStatus.ACTIVE;
      auction.startPrice = plan.startPrice.toFixed(2);
      auction.currentPrice = plan.startPrice.toFixed(2);
      auction.minBidIncrement = plan.minBidIncrement.toFixed(2);
      auction.startsAt = new Date(now);
      auction.endsAt = new Date(now + plan.endsInDays * DAY_MS);
      auction.winnerId = null;
      auction.winningBidId = null;
      auction.purchaseWindowEndsAt = null;
      auction.finalizedAt = null;
      await auctions.save(auction);
      reactivated += 1;
    }
    console.log(
      `Reactivated ${reactivated} existing well-matched auction(s) with realistic pricing.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to seed demo catalog:', error);
  process.exitCode = 1;
});
