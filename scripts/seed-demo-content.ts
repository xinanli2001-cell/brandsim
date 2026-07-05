// 一次性内容填充脚本：给搜索+评测台造一批有真实差异化的内容电商语料
// （不同类目、不同商品、不同话题标签），让 /search 和 /eval 看板的策略对比
// 有东西可比，而不是只有个位数帖子。幂等——按 text 是否已存在跳过，可重复跑。
// 用法: npx tsx scripts/seed-demo-content.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { buildSearchText } from "../lib/search/searchText";
import { normalizeHashtag } from "../lib/hashtag";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const BRAND_EMAILS = [
  "greenknit.official@example.com",
  "urbantech.gadgets@example.com",
  "cozyhome.living@example.com",
  "purebloom.beauty@example.com",
  "trailhead.outdoors@example.com",
  "harvest.kitchen@example.com",
  "littlesprouts.toys@example.com",
  "pawpartner.supplies@example.com",
];

interface SeedPost {
  author: number; // index into BRAND_EMAILS
  text: string;
  hashtags: string[];
  product: { title: string; category: string; price: number; tags: string[] };
}

const POSTS: SeedPost[] = [
  // Sustainable Fashion
  { author: 0, text: "Our best-selling eco sweater is back in stock — knitted from 100% recycled wool, perfect for chilly autumn mornings.", hashtags: ["SustainableFashion", "EcoSweater", "AutumnStyle"], product: { title: "Recycled Wool Crewneck Sweater", category: "Apparel", price: 68, tags: ["wool", "recycled", "sweater"] } },
  { author: 0, text: "Meet the Green Sweater — our flagship piece, dyed with plant-based pigments, zero synthetic dye runoff.", hashtags: ["GreenSweater", "SustainableFashion", "PlantDye"], product: { title: "Green Sweater", category: "Apparel", price: 72, tags: ["green", "plant-dye", "sweater"] } },
  { author: 0, text: "Cozy lifestyle essentials for the season: organic cotton hoodies that get softer with every wash.", hashtags: ["CozyLifestyle", "OrganicCotton", "Hoodie"], product: { title: "Organic Cotton Hoodie", category: "Apparel", price: 54, tags: ["cotton", "organic", "hoodie"] } },
  { author: 0, text: "Vegan leather tote bags, handmade in small batches — no animal products, no compromise on style.", hashtags: ["VeganLeather", "SustainableFashion", "Accessories"], product: { title: "Vegan Leather Tote", category: "Accessories", price: 89, tags: ["vegan", "leather", "bag"] } },
  { author: 0, text: "Limited edition release: our recycled denim jacket sold out in 48 hours last time, restocking this Friday.", hashtags: ["LimitedEdition", "RecycledDenim", "SustainableFashion"], product: { title: "Recycled Denim Jacket", category: "Apparel", price: 95, tags: ["denim", "recycled", "jacket"] } },
  { author: 0, text: "Wool scarves on discount this week only — grab one before winter hits, cheap and cozy.", hashtags: ["WoolScarf", "Discount", "WinterStyle"], product: { title: "Merino Wool Scarf", category: "Accessories", price: 29, tags: ["wool", "scarf", "winter"] } },
  { author: 0, text: "Minimalist home decor meets fashion: our new capsule collection favors clean lines and natural fibers.", hashtags: ["MinimalistStyle", "CapsuleWardrobe", "SustainableFashion"], product: { title: "Linen Wrap Dress", category: "Apparel", price: 76, tags: ["linen", "minimalist", "dress"] } },
  { author: 0, text: "Summer dress sale is live — breathable organic linen, perfect for hot afternoons.", hashtags: ["SummerDress", "Sale", "OrganicLinen"], product: { title: "Organic Linen Summer Dress", category: "Apparel", price: 62, tags: ["linen", "summer", "dress"] } },

  // Consumer Electronics
  { author: 1, text: "The new UrbanBuds Pro have 40-hour battery life and active noise cancellation — best selling accessory this quarter.", hashtags: ["UrbanBuds", "BestSelling", "Wireless"], product: { title: "UrbanBuds Pro Wireless Earbuds", category: "Electronics", price: 129, tags: ["earbuds", "wireless", "audio"] } },
  { author: 1, text: "Trendy sneakers aren't the only thing dropping this week — our smartwatch line just got a fresh new colorway.", hashtags: ["SmartWatch", "TrendyTech", "NewRelease"], product: { title: "Pulse Smartwatch", category: "Electronics", price: 199, tags: ["smartwatch", "fitness", "wearable"] } },
  { author: 1, text: "Back to school deals: our portable chargers are 20% off, never run out of battery between classes again.", hashtags: ["BackToSchool", "Deals", "PortableCharger"], product: { title: "10000mAh Portable Charger", category: "Electronics", price: 34, tags: ["charger", "portable", "battery"] } },
  { author: 1, text: "Gift for her under 50: our compact bluetooth speaker packs surprisingly deep bass into a tiny frame.", hashtags: ["GiftIdeas", "BluetoothSpeaker", "UnderFifty"], product: { title: "Compact Bluetooth Speaker", category: "Electronics", price: 45, tags: ["speaker", "bluetooth", "audio"] } },
  { author: 1, text: "Buy now, free shipping on all mechanical keyboards this weekend — the clicky switches everyone's asking for.", hashtags: ["MechanicalKeyboard", "FreeShipping", "BuyNow"], product: { title: "RGB Mechanical Keyboard", category: "Electronics", price: 89, tags: ["keyboard", "mechanical", "gaming"] } },
  { author: 1, text: "Our webcam upgrade finally fixes the low-light issue everyone complained about — crisp 1080p even at night.", hashtags: ["Webcam", "TechUpgrade", "WorkFromHome"], product: { title: "1080p Ring-Light Webcam", category: "Electronics", price: 58, tags: ["webcam", "video", "remote-work"] } },
  { author: 1, text: "Affordable jewelry isn't our thing, but affordable phone cases with card slots definitely are.", hashtags: ["PhoneAccessories", "Affordable", "EverydayCarry"], product: { title: "Card-Slot Phone Case", category: "Electronics", price: 19, tags: ["phone-case", "accessory", "wallet"] } },
  { author: 1, text: "Cheap discount weekend: last call on our clearance USB-C hubs before we retire this model.", hashtags: ["Clearance", "CheapDiscount", "USBHub"], product: { title: "7-in-1 USB-C Hub", category: "Electronics", price: 24, tags: ["usb-c", "hub", "clearance"] } },

  // Home & Living
  { author: 2, text: "Minimalist home decor drop: hand-thrown ceramic vases that make any shelf look intentional.", hashtags: ["MinimalistHomeDecor", "Ceramics", "HandMade"], product: { title: "Hand-Thrown Ceramic Vase", category: "Home", price: 42, tags: ["ceramic", "vase", "handmade"] } },
  { author: 2, text: "Recycled plastic accessories for your kitchen — cutting boards made entirely from ocean-bound plastic waste.", hashtags: ["RecycledPlastic", "SustainableKitchen", "EcoFriendly"], product: { title: "Recycled Plastic Cutting Board", category: "Home", price: 26, tags: ["recycled", "plastic", "kitchen"] } },
  { author: 2, text: "Cozy lifestyle brand favorite: our weighted blankets are back in three new colors this month.", hashtags: ["CozyLifestyleBrand", "WeightedBlanket", "HomeComfort"], product: { title: "Weighted Knit Blanket", category: "Home", price: 88, tags: ["blanket", "weighted", "cozy"] } },
  { author: 2, text: "Affordable jewelry stands made from bent recycled metal, perfect for that minimalist vanity setup.", hashtags: ["JewelryStand", "MinimalistStyle", "RecycledMetal"], product: { title: "Recycled Metal Jewelry Stand", category: "Home", price: 22, tags: ["jewelry-stand", "metal", "recycled"] } },
  { author: 2, text: "Handmade ceramics workshop pieces just landed — every mug is slightly different, that's the point.", hashtags: ["HandmadeCeramics", "ArtisanGoods", "KitchenDecor"], product: { title: "Artisan Stoneware Mug", category: "Home", price: 18, tags: ["ceramic", "mug", "handmade"] } },
  { author: 2, text: "Organic cotton bedsheets on sale — breathable, hypoallergenic, and finally on discount for fall.", hashtags: ["OrganicCotton", "BedSheets", "FallSale"], product: { title: "Organic Cotton Bedsheet Set", category: "Home", price: 79, tags: ["cotton", "bedsheets", "organic"] } },
  { author: 2, text: "Buy now: our bamboo drawer organizers sold out twice already this year, restock is limited.", hashtags: ["BambooOrganizer", "LimitedEdition", "HomeOrganization"], product: { title: "Bamboo Drawer Organizer Set", category: "Home", price: 33, tags: ["bamboo", "organizer", "storage"] } },
  { author: 2, text: "Recycled glass candle holders, hand-blown by a small studio we've partnered with for three years.", hashtags: ["RecycledGlass", "CandleHolder", "SmallBatch"], product: { title: "Hand-Blown Glass Candle Holder", category: "Home", price: 24, tags: ["glass", "candle", "recycled"] } },

  // Beauty & Personal Care
  { author: 3, text: "Our vegan face serum with hyaluronic acid just got reformulated — same price, better absorption.", hashtags: ["VeganSkincare", "FaceSerum", "CleanBeauty"], product: { title: "Hyaluronic Acid Face Serum", category: "Beauty", price: 38, tags: ["serum", "vegan", "skincare"] } },
  { author: 3, text: "Affordable jewelry meets skincare: our rose quartz gua sha tool is finally back and cheaper than before.", hashtags: ["GuaSha", "AffordableSkincare", "SelfCare"], product: { title: "Rose Quartz Gua Sha Tool", category: "Beauty", price: 16, tags: ["gua-sha", "rose-quartz", "self-care"] } },
  { author: 3, text: "Cheap price alert: our best-selling lip tint is on discount, stock up before the sale ends tonight.", hashtags: ["LipTint", "Discount", "BestSelling"], product: { title: "Tinted Lip Balm Trio", category: "Beauty", price: 14, tags: ["lip-tint", "makeup", "trio"] } },
  { author: 3, text: "Cozy lifestyle bath bombs, hand-poured with essential oils — the eucalyptus one sells out every single time.", hashtags: ["BathBombs", "CozyLifestyle", "EssentialOils"], product: { title: "Eucalyptus Bath Bomb Set", category: "Beauty", price: 22, tags: ["bath-bomb", "essential-oil", "relax"] } },
  { author: 3, text: "Sustainable fashion isn't just clothes — our refillable makeup compacts cut plastic waste by 80%.", hashtags: ["RefillableMakeup", "SustainableBeauty", "ZeroWaste"], product: { title: "Refillable Pressed Powder Compact", category: "Beauty", price: 28, tags: ["refillable", "compact", "zero-waste"] } },
  { author: 3, text: "Gift for her under 50: our travel-size skincare set covers cleanser, serum, and moisturizer in one pouch.", hashtags: ["GiftIdeas", "TravelSkincare", "UnderFifty"], product: { title: "Travel Skincare Trio", category: "Beauty", price: 32, tags: ["travel", "skincare", "trio"] } },
  { author: 3, text: "Organic cotton makeup rounds, reusable and machine washable, replaces 500 disposable pads a year.", hashtags: ["OrganicCotton", "ReusableRounds", "ZeroWaste"], product: { title: "Reusable Cotton Makeup Rounds", category: "Beauty", price: 12, tags: ["cotton", "reusable", "makeup"] } },
  { author: 3, text: "Trendy sneakers pair well with our new SPF-infused body lotion — beach season essential.", hashtags: ["SPFLotion", "BeachEssentials", "SummerSkincare"], product: { title: "SPF 30 Body Lotion", category: "Beauty", price: 24, tags: ["spf", "lotion", "summer"] } },

  // Sports & Outdoors
  { author: 4, text: "Trailhead's new hiking boots just passed our toughest waterproof test yet — Cascade trail approved.", hashtags: ["HikingBoots", "Waterproof", "TrailApproved"], product: { title: "Cascade Waterproof Hiking Boots", category: "Sports", price: 145, tags: ["hiking", "boots", "waterproof"] } },
  { author: 4, text: "Trendy sneakers for the trail, not just the street — our trail runners handle mud and rock equally well.", hashtags: ["TrendySneakers", "TrailRunning", "Outdoors"], product: { title: "AllTerrain Trail Runners", category: "Sports", price: 118, tags: ["trail-running", "sneakers", "outdoor"] } },
  { author: 4, text: "Best selling accessories this month: our collapsible water bottles fit any backpack side pocket.", hashtags: ["BestSelling", "WaterBottle", "HikingGear"], product: { title: "Collapsible Silicone Water Bottle", category: "Sports", price: 19, tags: ["water-bottle", "collapsible", "hiking"] } },
  { author: 4, text: "Cheap discount on camping hammocks this week — perfect gift for the outdoorsy person in your life.", hashtags: ["CampingHammock", "Discount", "GiftIdeas"], product: { title: "Parachute Nylon Camping Hammock", category: "Sports", price: 42, tags: ["hammock", "camping", "nylon"] } },
  { author: 4, text: "Limited edition release: our merino base layers restock Friday, sold out in under a day last winter.", hashtags: ["LimitedEdition", "MerinoWool", "BaseLayer"], product: { title: "Merino Wool Base Layer Set", category: "Sports", price: 68, tags: ["merino", "base-layer", "winter"] } },
  { author: 4, text: "Buy now, free shipping on all headlamps this weekend — rechargeable and rated for 6 hours continuous use.", hashtags: ["Headlamp", "FreeShipping", "CampingGear"], product: { title: "Rechargeable LED Headlamp", category: "Sports", price: 29, tags: ["headlamp", "camping", "rechargeable"] } },
  { author: 4, text: "Affordable jewelry has nothing on our carabiner keychains — functional, rugged, and genuinely useful.", hashtags: ["Carabiner", "Affordable", "EverydayCarry"], product: { title: "Aluminum Carabiner Keychain", category: "Sports", price: 9, tags: ["carabiner", "keychain", "outdoor"] } },
  { author: 4, text: "Summer dress optional, summer trail mandatory — our lightweight daypacks are on sale through August.", hashtags: ["Daypack", "SummerSale", "HikingGear"], product: { title: "Lightweight 20L Daypack", category: "Sports", price: 55, tags: ["daypack", "hiking", "lightweight"] } },

  // Food & Beverage
  { author: 5, text: "Our small-batch cold brew concentrate is finally shelf-stable — no fridge needed until you open it.", hashtags: ["ColdBrew", "SmallBatch", "CoffeeLovers"], product: { title: "Cold Brew Concentrate", category: "Food", price: 16, tags: ["coffee", "cold-brew", "concentrate"] } },
  { author: 5, text: "Affordable jewelry can wait, our honey and granola gift box can't — perfect for last-minute gifting.", hashtags: ["GiftBox", "Granola", "Honey"], product: { title: "Honey & Granola Gift Box", category: "Food", price: 27, tags: ["honey", "granola", "gift"] } },
  { author: 5, text: "Best selling accessories aside, our new hot sauce trio is what everyone's actually asking about.", hashtags: ["HotSauce", "BestSelling", "SmallBatch"], product: { title: "Hot Sauce Trio Pack", category: "Food", price: 21, tags: ["hot-sauce", "trio", "spicy"] } },
  { author: 5, text: "Cheap price alert on our herbal tea sampler — 12 flavors, discount ends Sunday night.", hashtags: ["HerbalTea", "Discount", "TeaLovers"], product: { title: "12-Flavor Herbal Tea Sampler", category: "Food", price: 24, tags: ["tea", "herbal", "sampler"] } },
  { author: 5, text: "Organic cotton isn't edible, but our organic dark chocolate bars are — 85% cacao, ethically sourced.", hashtags: ["OrganicChocolate", "EthicallySourced", "DarkChocolate"], product: { title: "85% Organic Dark Chocolate Bar", category: "Food", price: 8, tags: ["chocolate", "organic", "cacao"] } },
  { author: 5, text: "Buy now, free shipping on our sparkling water variety pack — zero sugar, all the fizz.", hashtags: ["SparklingWater", "FreeShipping", "ZeroSugar"], product: { title: "Sparkling Water Variety 12-Pack", category: "Food", price: 18, tags: ["sparkling-water", "zero-sugar", "variety"] } },
  { author: 5, text: "Trendy sneakers won't help you cook, but our cast-iron seasoning spray will — one spray, no more sticking.", hashtags: ["CastIronCare", "KitchenEssentials", "CookingTips"], product: { title: "Cast-Iron Seasoning Spray", category: "Food", price: 11, tags: ["cast-iron", "seasoning", "cooking"] } },
  { author: 5, text: "Gift for her under 50: our artisan jam trio pairs perfectly with the cozy lifestyle aesthetic she loves.", hashtags: ["ArtisanJam", "GiftIdeas", "CozyLifestyle"], product: { title: "Artisan Jam Trio", category: "Food", price: 19, tags: ["jam", "artisan", "trio"] } },

  // Toys & Kids
  { author: 6, text: "Little Sprouts' wooden building blocks just won a parenting award — no small parts, ages 2 and up.", hashtags: ["WoodenToys", "ParentingAward", "SafeForToddlers"], product: { title: "Wooden Building Block Set", category: "Kids", price: 34, tags: ["wooden", "blocks", "toddler"] } },
  { author: 6, text: "Back to school deals: our kids' backpacks with reflective strips are 15% off through September.", hashtags: ["BackToSchool", "KidsBackpack", "Deals"], product: { title: "Reflective Kids Backpack", category: "Kids", price: 29, tags: ["backpack", "kids", "reflective"] } },
  { author: 6, text: "Affordable jewelry-making kits for kids — teaches fine motor skills disguised as fun.", hashtags: ["JewelryMakingKit", "Affordable", "KidsCrafts"], product: { title: "Kids Jewelry Making Kit", category: "Kids", price: 17, tags: ["jewelry", "craft", "kids"] } },
  { author: 6, text: "Buy now: our glow-in-the-dark puzzle sets sold out twice this year, restock is limited.", hashtags: ["GlowPuzzle", "LimitedEdition", "KidsToys"], product: { title: "Glow-in-the-Dark Puzzle Set", category: "Kids", price: 21, tags: ["puzzle", "glow", "kids"] } },
  { author: 6, text: "Organic cotton plush toys, machine washable, filled with hypoallergenic fiber for sensitive kids.", hashtags: ["OrganicCotton", "PlushToys", "HypoallergenicKids"], product: { title: "Organic Cotton Plush Bear", category: "Kids", price: 26, tags: ["plush", "organic", "kids"] } },
  { author: 6, text: "Cheap discount weekend on our stacking rings toy — a nursery classic, finally on sale.", hashtags: ["StackingRings", "CheapDiscount", "NurseryClassic"], product: { title: "Wooden Stacking Rings", category: "Kids", price: 13, tags: ["stacking", "wooden", "infant"] } },

  // Pet Supplies
  { author: 7, text: "PawPartner's new orthopedic dog bed just passed vet review — memory foam that actually supports aging joints.", hashtags: ["OrthopedicDogBed", "VetApproved", "PetComfort"], product: { title: "Orthopedic Memory Foam Dog Bed", category: "Pets", price: 79, tags: ["dog-bed", "orthopedic", "memory-foam"] } },
  { author: 7, text: "Best selling accessories for cats this month: our scratching post tower with a hidden hammock level.", hashtags: ["BestSelling", "CatTower", "ScratchingPost"], product: { title: "Cat Scratching Post Tower", category: "Pets", price: 65, tags: ["cat-tower", "scratching-post", "hammock"] } },
  { author: 7, text: "Recycled plastic accessories aren't just for humans — our chew-proof dog toys are made from ocean plastic.", hashtags: ["RecycledPlastic", "DogToys", "ChewProof"], product: { title: "Ocean Plastic Dog Chew Toy", category: "Pets", price: 15, tags: ["dog-toy", "recycled", "chew-proof"] } },
  { author: 7, text: "Buy now, free shipping on our automatic pet feeders — never miss a feeding schedule again.", hashtags: ["AutomaticFeeder", "FreeShipping", "PetTech"], product: { title: "WiFi Automatic Pet Feeder", category: "Pets", price: 89, tags: ["feeder", "automatic", "pet-tech"] } },
  { author: 7, text: "Affordable jewelry for pets? Our engraved ID tags are cheap, durable, and ship within a day.", hashtags: ["PetIDTag", "Affordable", "Engraved"], product: { title: "Engraved Stainless Pet ID Tag", category: "Pets", price: 7, tags: ["id-tag", "engraved", "pet"] } },
  { author: 7, text: "Cheap discount on cat litter this week only — clumping formula, low dust, stock up now.", hashtags: ["CatLitter", "CheapDiscount", "LowDust"], product: { title: "Clumping Low-Dust Cat Litter", category: "Pets", price: 22, tags: ["litter", "clumping", "cat"] } },
];

async function main() {
  const users = new Map<string, string>();
  for (const email of BRAND_EMAILS) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash("demo-password-123", 10);
      user = await prisma.user.create({ data: { email, passwordHash, role: "student" } });
    }
    users.set(email, user.id);
  }

  let createdPosts = 0;
  let skippedPosts = 0;
  for (const p of POSTS) {
    const existing = await prisma.post.findFirst({ where: { text: p.text } });
    if (existing) {
      skippedPosts++;
      continue;
    }
    const authorId = users.get(BRAND_EMAILS[p.author])!;
    const hashtags = p.hashtags.map(normalizeHashtag);
    const product = await prisma.product.create({ data: p.product });
    const searchText = buildSearchText({ text: p.text, hashtags, product: p.product });

    await prisma.post.create({
      data: {
        authorId,
        text: p.text,
        searchText,
        hashtags,
        source: "free",
        productId: product.id,
      },
    });
    createdPosts++;
  }

  const totalPosts = await prisma.post.count();
  console.log(`== created ${createdPosts} new posts, skipped ${skippedPosts} already-present, ${totalPosts} total posts in DB ==`);
  console.log("\n✅ Demo content seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
