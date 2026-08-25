/**
 * Demo/catalog image strategy — used only when a product has no
 * seller/admin-uploaded `imageUrls`. A real uploaded image always wins;
 * see `ProductImage` for the full priority order.
 *
 * Resolution priority:
 *   1. uploaded product image (handled by the caller, not here)
 *   2. exact product-name keyword match (specific product type)
 *   3. category-name fallback pool (only when no keyword matched)
 *   4. null → caller shows the branded fallback, never a guessed image
 *
 * Every keyword group is checked as its own regex before any broader/
 * category-level matching happens, and more specific multi-word phrases
 * are listed before the single-word groups they'd otherwise be captured
 * by (e.g. "gaming mouse" must resolve before the bare "mouse" group is
 * even reached, and "smart watch" before the bare "watch" group).
 *
 * All URLs are stable Unsplash CDN links (images.unsplash.com/photo-<id>),
 * individually verified reachable (HTTP 200) before being added here — see
 * `verify-product-images.mjs`. Never the deprecated source.unsplash.com
 * redirect service, which returns a different random image per request.
 */

// ---------------------------------------------------------------------------
// Image pools — 2-4 verified alternatives per semantic group so a category
// full of the same product type doesn't render one repeated photo.
// ---------------------------------------------------------------------------

const POOL = {
  smartphone: [
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97',
  ],
  laptop: [
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
    'https://images.unsplash.com/photo-1541807084-5c52b6b3adef',
  ],
  headphones: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b',
  ],
  earbuds: [
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df',
    'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434',
  ],
  keyboard: [
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3',
    'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef',
  ],
  mouse: [
    'https://images.unsplash.com/photo-1527814050087-3793815479db',
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7',
  ],
  monitor: [
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf',
    'https://images.unsplash.com/photo-1547082299-de196ea013d6',
  ],
  camera: [
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd',
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32',
  ],
  smartwatch: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
    'https://images.unsplash.com/photo-1579586337278-3befd40fd17a',
  ],
  tablet: [
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0',
    'https://images.unsplash.com/photo-1561154464-82e9adf32764',
  ],
  gamingController: [
    'https://images.unsplash.com/photo-1592840062661-a5a7f78e2056',
    'https://images.unsplash.com/photo-1580327344181-c1163234e5a0',
  ],
  gamingHeadset: [
    'https://images.unsplash.com/photo-1599669454699-248893623440',
    'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb',
  ],
  gamingConsole: [
    'https://images.unsplash.com/photo-1486401899868-0e435ed85128',
    'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3',
    'https://images.unsplash.com/photo-1580327344181-c1163234e5a0',
  ],
  speaker: [
    'https://images.unsplash.com/photo-1545454675-3531b543be5d',
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1',
  ],
  ereader: [
    'https://images.unsplash.com/photo-1592496431122-2349e0fbc666',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c',
  ],
  sneakers: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a',
  ],
  jacket: [
    'https://images.unsplash.com/photo-1551028719-00167b16eac5',
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea',
  ],
  hoodie: [
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7',
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633',
  ],
  tshirt: [
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27',
  ],
  jeans: [
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246',
    'https://images.unsplash.com/photo-1475178626620-a4d074967452',
  ],
  backpack: [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3',
  ],
  handbag: [
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa',
  ],
  watch: [
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d',
    'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3',
  ],
  sunglasses: [
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f',
    'https://images.unsplash.com/photo-1511499767150-a48a237f0083',
  ],
  lamp: [
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c',
    'https://images.unsplash.com/photo-1540932239986-30128078f3c5',
  ],
  coffeeMaker: [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085',
    'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6',
  ],
  cookware: [
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d',
    'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1',
  ],
  homeDecor: [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f',
  ],
  plant: [
    'https://images.unsplash.com/photo-1485955900006-10f4d324d411',
    'https://images.unsplash.com/photo-1462530260150-162092dbf011',
  ],
  bedding: [
    'https://images.unsplash.com/photo-1522771930-78848d9293e8',
    'https://images.unsplash.com/photo-1567016432779-094069958ea5',
  ],
  vacuum: [
    'https://images.unsplash.com/photo-1558317374-067fb5f30001',
    'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1',
  ],
  skincare: [
    'https://images.unsplash.com/photo-1556228720-195a672e8a03',
    'https://images.unsplash.com/photo-1571875257727-256c39da42af',
  ],
  perfume: [
    'https://images.unsplash.com/photo-1541643600914-78b084683601',
    'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539',
  ],
  makeup: [
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
    'https://images.unsplash.com/photo-1512496015851-a90fb38ba796',
  ],
  hairCare: [
    'https://images.unsplash.com/photo-1519699047748-de8e457a634e',
    'https://images.unsplash.com/photo-1522337660859-02fbefca4702',
  ],
  sportsBall: [
    'https://images.unsplash.com/photo-1521412644187-c49fa049e84d',
    'https://images.unsplash.com/photo-1614632537197-38a17061c2bd',
  ],
  fitnessGear: [
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b',
  ],
  yoga: [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a',
  ],
  bicycle: [
    'https://images.unsplash.com/photo-1485965120184-e220f721d03e',
    'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8',
  ],
  camping: [
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4',
    'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d',
  ],
  book: [
    'https://images.unsplash.com/photo-1512820790803-83ca734da794',
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570',
  ],
  toyBlocks: [
    'https://images.unsplash.com/photo-1558877385-81a1c7e67d72',
    'https://images.unsplash.com/photo-1545558014-8692077e9b5c',
  ],
  plushToy: [
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088',
    'https://images.unsplash.com/photo-1553481187-be93c21490a9',
  ],
  boardGame: [
    'https://images.unsplash.com/photo-1606503153255-59d8b8b82176',
    'https://images.unsplash.com/photo-1632501641765-e568d28b0015',
  ],
  babyGear: [
    'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61',
  ],
  petSupplies: [
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1',
    'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb',
  ],
  jewelry: [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338',
    'https://images.unsplash.com/photo-1599643477877-530eb83abc8e',
  ],
  toolset: [
    'https://images.unsplash.com/photo-1504148455328-c376907d081c',
    'https://images.unsplash.com/photo-1530124566582-a618bc2615dc',
  ],
} as const;

type PoolKey = keyof typeof POOL;

// ---------------------------------------------------------------------------
// Keyword groups, ordered specific → generic. First match wins, so a
// multi-word phrase that's a subset of a broader group (e.g. "gaming
// mouse" vs. plain "mouse") must be listed above that broader group.
// ---------------------------------------------------------------------------

const KEYWORD_GROUPS: Array<{ pattern: RegExp; pool: PoolKey }> = [
  // --- Electronics: specific device phrases before their generic nouns ---
  { pattern: /gaming (mouse)/, pool: 'mouse' },
  { pattern: /gaming (headset|headphone)/, pool: 'gamingHeadset' },
  { pattern: /gaming (controller|gamepad)/, pool: 'gamingController' },
  // Controller/headset checked before the console trigger below, since
  // console brand names (Xbox, PlayStation) also appear on their own
  // controllers/headsets — "Xbox Wireless Controller" must resolve to a
  // controller photo, not a console photo.
  { pattern: /\bcontroller\b|gamepad/, pool: 'gamingController' },
  { pattern: /\bheadset\b/, pool: 'gamingHeadset' },
  { pattern: /gaming console|game console|\bconsole\b|playstation|\bxbox\b|nintendo switch/, pool: 'gamingConsole' },
  { pattern: /soundbar|bluetooth speaker|\bspeaker\b/, pool: 'speaker' },
  { pattern: /\bkindle\b|e-?reader/, pool: 'ereader' },
  { pattern: /smart\s?watch/, pool: 'smartwatch' },
  { pattern: /\btablet\b|\bipad\b/, pool: 'tablet' },
  { pattern: /iphone|smartphone|galaxy phone|pixel phone|\bphone\b/, pool: 'smartphone' },
  { pattern: /earbud|airpod|in-ear/, pool: 'earbuds' },
  { pattern: /headphone|over-ear headset/, pool: 'headphones' },
  { pattern: /laptop|macbook|notebook computer/, pool: 'laptop' },
  { pattern: /mechanical keyboard|\bkeyboard\b/, pool: 'keyboard' },
  { pattern: /gaming mouse|wireless mouse|\bmouse\b/, pool: 'mouse' },
  { pattern: /\bmonitor\b|\bdisplay\b/, pool: 'monitor' },
  { pattern: /\bcamera\b/, pool: 'camera' },

  // --- Fashion ---
  { pattern: /running shoe|sneaker|trainers|air jordan|\bshoe/, pool: 'sneakers' },
  { pattern: /jacket|\bcoat\b/, pool: 'jacket' },
  { pattern: /hoodie|sweatshirt/, pool: 'hoodie' },
  { pattern: /\bjeans\b|denim/, pool: 'jeans' },
  { pattern: /t-?shirt|\btee\b/, pool: 'tshirt' },
  { pattern: /backpack/, pool: 'backpack' },
  { pattern: /handbag|purse|\btote\b/, pool: 'handbag' },
  { pattern: /sunglass/, pool: 'sunglasses' },
  { pattern: /smart\s?watch/, pool: 'smartwatch' },
  { pattern: /\bwatch\b/, pool: 'watch' },
  { pattern: /necklace|bracelet|earring|\bring\b|jewelry|jewellery/, pool: 'jewelry' },

  // --- Home ---
  { pattern: /coffee (maker|machine)/, pool: 'coffeeMaker' },
  { pattern: /vacuum/, pool: 'vacuum' },
  { pattern: /\blamp\b|light fixture/, pool: 'lamp' },
  { pattern: /cookware|\bpan\b|pot set|\bpots\b/, pool: 'cookware' },
  { pattern: /\bplant\b/, pool: 'plant' },
  { pattern: /bedding|duvet|comforter|\bpillow\b/, pool: 'bedding' },
  { pattern: /decor|vase|candle|wall art/, pool: 'homeDecor' },

  // --- Beauty ---
  { pattern: /perfume|fragrance|cologne/, pool: 'perfume' },
  { pattern: /skincare|moistur|serum|face cream/, pool: 'skincare' },
  { pattern: /makeup|lipstick|mascara/, pool: 'makeup' },
  { pattern: /shampoo|conditioner|hair (care|dryer|straightener)/, pool: 'hairCare' },

  // --- Sports & outdoors ---
  { pattern: /\byoga\b|\bmat\b/, pool: 'yoga' },
  { pattern: /bicycle|\bbike\b/, pool: 'bicycle' },
  { pattern: /\btent\b|camping|hiking/, pool: 'camping' },
  { pattern: /dumbbell|\bgym\b|fitness/, pool: 'fitnessGear' },
  { pattern: /\bball\b|football|basketball|soccer/, pool: 'sportsBall' },

  // --- Books & media ---
  { pattern: /novel|paperback|hardcover|\bbook\b/, pool: 'book' },
  { pattern: /board game/, pool: 'boardGame' },

  // --- Toys & kids ---
  { pattern: /teddy|plush/, pool: 'plushToy' },
  { pattern: /\blego\b|building block|\btoy\b/, pool: 'toyBlocks' },
  { pattern: /stroller|baby (gear|monitor)/, pool: 'babyGear' },

  // --- Misc ---
  { pattern: /\bleash\b|pet (bed|toy|food)/, pool: 'petSupplies' },
  { pattern: /tool ?set|\bwrench\b|screwdriver/, pool: 'toolset' },
];

/** Category-name fallback, used only when NO keyword above matched. Kept
 * intentionally narrow/safe per group so a mismatched sub-type inside a
 * broad category is rare; anything genuinely ambiguous should fall
 * through to the branded fallback instead of guessing. */
const CATEGORY_FALLBACK: Array<{ pattern: RegExp; pool: PoolKey[] }> = [
  { pattern: /electronic|tech|gadget|computer/, pool: ['smartphone', 'laptop', 'headphones', 'keyboard'] },
  { pattern: /fashion|apparel|cloth|wear|shoe/, pool: ['sneakers', 'jacket', 'hoodie', 'backpack'] },
  { pattern: /home|furniture|kitchen|decor/, pool: ['lamp', 'coffeeMaker', 'homeDecor', 'cookware'] },
  { pattern: /beauty|cosmetic|skincare|fragrance/, pool: ['skincare', 'perfume', 'makeup'] },
  { pattern: /gam(e|ing)/, pool: ['gamingController', 'gamingHeadset', 'gamingConsole'] },
  { pattern: /sport|fitness|outdoor/, pool: ['sportsBall', 'fitnessGear', 'bicycle'] },
  { pattern: /book|media|reading/, pool: ['book'] },
  { pattern: /toy|kid|child/, pool: ['toyBlocks', 'plushToy'] },
];

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickFromPool(pool: readonly string[], seed: string): string {
  return pool[stableHash(seed) % pool.length];
}

/** Which semantic group + image a product resolves to — exposed so the
 * verification script can print it for manual auditing (see task spec). */
export interface ResolvedImage {
  group: PoolKey | 'category-fallback' | 'none';
  url: string | null;
}

export function resolveDemoImage(product: {
  id: string;
  name: string;
  categoryName?: string | null;
}): ResolvedImage {
  const name = product.name.toLowerCase();

  for (const { pattern, pool } of KEYWORD_GROUPS) {
    if (pattern.test(name)) {
      return { group: pool, url: pickFromPool(POOL[pool], product.id) };
    }
  }

  const category = (product.categoryName ?? '').toLowerCase();
  const haystack = category || name;
  for (const { pattern, pool } of CATEGORY_FALLBACK) {
    if (pattern.test(haystack)) {
      const flatPool = pool.flatMap((key) => POOL[key]);
      return { group: 'category-fallback', url: pickFromPool(flatPool, product.id) };
    }
  }

  return { group: 'none', url: null };
}

export function resolveDemoImageUrl(product: {
  id: string;
  name: string;
  categoryName?: string | null;
}): string | null {
  return resolveDemoImage(product).url;
}

export function withImageParams(url: string, params: string): string {
  return `${url}?${params}`;
}

/** Representative image for a category shortcut tile. */
export function resolveCategoryImageUrl(categoryName: string): string | null {
  const haystack = categoryName.toLowerCase();
  for (const { pattern, pool } of CATEGORY_FALLBACK) {
    if (pattern.test(haystack)) return POOL[pool[0]][0];
  }
  return null;
}
