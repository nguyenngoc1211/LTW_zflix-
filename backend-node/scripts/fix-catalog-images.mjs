// Tìm ảnh THẬT trên Wikimedia Commons cho từng dòng CSV, verify 200, ghi lại ngay.
// Chạy: node scripts/fix-catalog-images.mjs
import fs from "node:fs";
import { parseCsvLine } from "../src/modules/visual-shopping/csv.js";

const UA = "ZflixCatalogSeeder/1.0 (educational project; dev@zflix.local) node-fetch";
const SEARCH_TERMS = {
  "Cốc sứ": "black coffee cup latte",
  "Bàn cà phê": "cafe table tiles",
  "Ghế sắt": "metal garden chair",
  "Chậu cây": "green plant pot",
  "Cốc": "ceramic coffee cup",
  "Bàn": "wooden table cafe",
  "Ghế": "outdoor chair",
  "Cây": "indoor plant",
  "Áo hoodie": "white hoodie",
  "Giày thể thao": "white sneakers shoes",
  "Đèn bàn": "table lamp",
  "Túi tote": "leather tote bag",
  "Kính râm": "sunglasses",
  "Bàn học": "wooden desk",
  "Quạt bàn": "desk fan",
  "Loa bluetooth": "bluetooth speaker",
  "Sổ tay": "notebook journal",
  "Bộ cốc": "ceramic coffee cup",
  "Máy pha": "coffee maker machine",
  "Khăn giấy": "paper napkins",
  "Muỗng": "teaspoon stainless",
  "Khay": "wooden serving tray",
  "Ly thủy tinh": "glass cup transparent",
  "Bình giữ nhiệt": "thermos flask stainless",
  "Đèn trang trí": "fairy lights decoration",
  "Túi tote": "tote bag canvas",
};

const findImage = async (query) => {
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("generator", "search");
  api.searchParams.set("gsrsearch", `filetype:bitmap ${query}`);
  api.searchParams.set("gsrnamespace", "6");
  api.searchParams.set("gsrlimit", "10");
  api.searchParams.set("prop", "imageinfo");
  api.searchParams.set("iiprop", "url|mime");
  api.searchParams.set("iiurlwidth", "500");
  api.searchParams.set("format", "json");
  const json = await (await fetch(api, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) })).json();
  const pages = Object.values(json?.query?.pages || {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || info.mime !== "image/jpeg" || !info.thumburl) continue;
    const check = await fetch(info.thumburl, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (check.status === 200) return info.thumburl;
  }
  return null;
};

const termFor = (name) => {
  const entries = Object.entries(SEARCH_TERMS).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, term] of entries) {
    if (name.toLowerCase().includes(prefix.toLowerCase())) return term;
  }
  return null;
};

const csvPath = process.argv[2] || "data/products.sample.csv";
const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
const outLines = [header.join(",")];

let fixed = 0;
for (const line of lines.slice(1)) {
  const cols = parseCsvLine(line);
  const record = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
  const name = record.name;
  let imageUrl = record.image_url;
  // Verify URL hiện tại; chết thì tìm ảnh thay thế
  let status = 0;
  try {
    status = (await fetch(imageUrl, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) })).status;
  } catch {}
  if (status !== 200) {
    const term = termFor(name);
    const found = term ? await findImage(term) : null;
    if (found) {
      console.log(`✓ ${name}: ${status} -> ảnh mới ${found.slice(-45)}`);
      imageUrl = found;
      fixed += 1;
    } else {
      console.log(`✗ ${name}: ảnh cũ ${status} và không tìm thấy thay thế — BỎ dòng`);
      continue;
    }
  } else {
    console.log(`= ${name}: ảnh cũ OK`);
  }
  // Ghi lại dòng với image_url mới (cột image_url là cột áp chót, availability cuối)
  record.image_url = imageUrl;
  outLines.push(header.map((h) => {
    const value = record[h] ?? "";
    return /,/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  }).join(","));
  await new Promise((r) => setTimeout(r, 350));
}

fs.writeFileSync(csvPath, outLines.join("\n") + "\n");
console.log(`\n=> đã sửa ${fixed} ảnh, CSV ghi lại vào ${csvPath}`);
