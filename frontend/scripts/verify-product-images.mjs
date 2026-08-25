#!/usr/bin/env node
// Debug/verification tool for the demo-image resolver (frontend/src/lib/productImages.ts).
// Not wired into any build step — run manually:
//   node scripts/verify-product-images.mjs [BASE_URL]
// Prints: product name -> detected semantic group -> resolved image URL,
// for every product currently in the live catalog, so mismatches can be
// eyeballed directly against real data instead of guessed at.

const BASE_URL = process.argv[2] ?? 'http://localhost:3000/api';

// Mirrors src/lib/productImages.ts's matching logic in plain JS (no build
// step needed to run this against a live backend).

const KEYWORD_GROUPS = [
  [/gaming (mouse)/, 'mouse'],
  [/gaming (headset|headphone)/, 'gamingHeadset'],
  [/gaming (controller|gamepad)/, 'gamingController'],
  [/\bcontroller\b|gamepad/, 'gamingController'],
  [/\bheadset\b/, 'gamingHeadset'],
  [/gaming console|game console|\bconsole\b|playstation|\bxbox\b|nintendo switch/, 'gamingConsole'],
  [/soundbar|bluetooth speaker|\bspeaker\b/, 'speaker'],
  [/\bkindle\b|e-?reader/, 'ereader'],
  [/smart\s?watch/, 'smartwatch'],
  [/\btablet\b|\bipad\b/, 'tablet'],
  [/iphone|smartphone|galaxy phone|pixel phone|\bphone\b/, 'smartphone'],
  [/earbud|airpod|in-ear/, 'earbuds'],
  [/headphone|over-ear headset/, 'headphones'],
  [/laptop|macbook|notebook computer/, 'laptop'],
  [/mechanical keyboard|\bkeyboard\b/, 'keyboard'],
  [/gaming mouse|wireless mouse|\bmouse\b/, 'mouse'],
  [/\bmonitor\b|\bdisplay\b/, 'monitor'],
  [/\bcamera\b/, 'camera'],
  [/running shoe|sneaker|trainers|air jordan|\bshoe/, 'sneakers'],
  [/jacket|\bcoat\b/, 'jacket'],
  [/hoodie|sweatshirt/, 'hoodie'],
  [/\bjeans\b|denim/, 'jeans'],
  [/t-?shirt|\btee\b/, 'tshirt'],
  [/backpack/, 'backpack'],
  [/handbag|purse|\btote\b/, 'handbag'],
  [/sunglass/, 'sunglasses'],
  [/\bwatch\b/, 'watch'],
  [/necklace|bracelet|earring|\bring\b|jewelry|jewellery/, 'jewelry'],
  [/coffee (maker|machine)/, 'coffeeMaker'],
  [/vacuum/, 'vacuum'],
  [/\blamp\b|light fixture/, 'lamp'],
  [/cookware|\bpan\b|pot set|\bpots\b/, 'cookware'],
  [/\bplant\b/, 'plant'],
  [/bedding|duvet|comforter|\bpillow\b/, 'bedding'],
  [/decor|vase|candle|wall art/, 'homeDecor'],
  [/perfume|fragrance|cologne/, 'perfume'],
  [/skincare|moistur|serum|face cream/, 'skincare'],
  [/makeup|lipstick|mascara/, 'makeup'],
  [/shampoo|conditioner|hair (care|dryer|straightener)/, 'hairCare'],
  [/\byoga\b|\bmat\b/, 'yoga'],
  [/bicycle|\bbike\b/, 'bicycle'],
  [/\btent\b|camping|hiking/, 'camping'],
  [/dumbbell|\bgym\b|fitness/, 'fitnessGear'],
  [/\bball\b|football|basketball|soccer/, 'sportsBall'],
  [/novel|paperback|hardcover|\bbook\b/, 'book'],
  [/board game/, 'boardGame'],
  [/teddy|plush/, 'plushToy'],
  [/\blego\b|building block|\btoy\b/, 'toyBlocks'],
  [/stroller|baby (gear|monitor)/, 'babyGear'],
  [/\bleash\b|pet (bed|toy|food)/, 'petSupplies'],
  [/tool ?set|\bwrench\b|screwdriver/, 'toolset'],
];

const CATEGORY_FALLBACK = [
  [/electronic|tech|gadget|computer/, 'electronics-fallback'],
  [/fashion|apparel|cloth|wear|shoe/, 'fashion-fallback'],
  [/home|furniture|kitchen|decor/, 'home-fallback'],
  [/beauty|cosmetic|skincare|fragrance/, 'beauty-fallback'],
  [/gam(e|ing)/, 'gaming-fallback (controller/headset/console)'],
  [/sport|fitness|outdoor/, 'sports-fallback'],
  [/book|media|reading/, 'books-fallback'],
  [/toy|kid|child/, 'toys-fallback'],
];

function detect(name, categoryName) {
  const lname = name.toLowerCase();
  for (const [pattern, group] of KEYWORD_GROUPS) {
    if (pattern.test(lname)) return group;
  }
  const haystack = (categoryName ?? '').toLowerCase() || lname;
  for (const [pattern, group] of CATEGORY_FALLBACK) {
    if (pattern.test(haystack)) return group;
  }
  return 'none (branded fallback)';
}

async function main() {
  const filterKeyword = process.argv[3]; // optional: only print rows matching this substring
  let page = 1;
  let totalPages = 1;
  const rows = [];
  const counts = new Map();

  do {
    const res = await fetch(`${BASE_URL}/products?page=${page}&pageSize=100`);
    if (!res.ok) throw new Error(`GET /products -> ${res.status}`);
    const { data, meta } = await res.json();
    totalPages = meta.totalPages;
    for (const p of data) {
      const hasUpload = p.imageUrls?.length > 0;
      const group = hasUpload ? 'uploaded-image (skips resolver)' : detect(p.name, p.categoryName);
      counts.set(group, (counts.get(group) ?? 0) + 1);
      rows.push({ name: p.name, category: p.categoryName, group });
    }
    page += 1;
  } while (page <= totalPages);

  console.log(`${rows.length} products in catalog\n`);
  for (const r of rows) {
    if (filterKeyword && !r.name.toLowerCase().includes(filterKeyword.toLowerCase())) continue;
    console.log(`${r.name.padEnd(38)} [${r.category ?? '—'}] -> ${r.group}`);
  }

  console.log('\n--- summary ---');
  for (const [group, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${String(count).padStart(4)}  ${group}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
