// Remove local Endgame demo products from visual_products.
// Usage: node scripts/cleanup-endgame-demo.mjs
import "dotenv/config";
import { mongoCollection, closeMongo } from "../src/core/database/mongo.js";
import { rebuildIndex } from "../src/modules/visual-shopping/vector.index.js";

const visualProducts = await mongoCollection("visual_products");
const result = await visualProducts.deleteMany({ demo: true, demo_source: "endgame" });
await rebuildIndex();
console.log(`Đã xóa ${result.deletedCount} sản phẩm demo Endgame.`);
await closeMongo();
