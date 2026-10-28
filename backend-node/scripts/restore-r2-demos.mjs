// Khôi phục 2 phim demo HLS của nhánh Nam (Phim Demo Nam — Lẻ / Bộ).
//
// Bối cảnh: `seed:omdb` bước ① xoá toàn bộ content cũ (giữ users), nên 2 phim
// demo R2 bị xoá khỏi DB. File video vẫn còn trên R2 nên dựng lại được.
//
// Script idempotent: nếu production đã tồn tại thì bỏ qua, không tạo trùng.
//
// Chạy: node scripts/restore-r2-demos.mjs

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url), override: false });
const { pool } = await import("../src/core/database/pool.js");

const PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || "").replace(/\/+$/, "");
if (!PUBLIC_DOMAIN) {
  console.error("❌ Thiếu R2_PUBLIC_DOMAIN trong backend-node/.env");
  process.exit(1);
}

// Thông tin lấy từ chính object trên R2 (đã kiểm tra: playlist 200, số segment,
// tổng thời lượng) — không bịa số.
const DEMOS = [
  {
    slug: "phim-demo-nam-le-hls-r2",
    title: "Phim Demo Nam — Lẻ (HLS R2)",
    type: "movie",
    duration: 929,
    dir: "1792479683719-545",
    rawKey: "raw/movies/1792479683719-545.mp4",
    year: 2026,
  },
  {
    slug: "phim-demo-nam-bo-hls-r2",
    title: "Phim Demo Nam — Bộ (HLS R2)",
    type: "series",
    duration: 1400,
    dir: "1792480481546-125",
    rawKey: "raw/movies/1792480481546-125.mp4",
    year: 2026,
  },
];

const run = async () => {
  for (const demo of DEMOS) {
    const hlsUrl = `${PUBLIC_DOMAIN}/hls/${demo.dir}/playlist.m3u8`;

    const [existing] = await pool.execute(
      "SELECT id, title FROM productions WHERE slug = ? LIMIT 1",
      [demo.slug],
    );
    if (existing.length) {
      console.log(`  ${demo.title} ... bỏ qua (đã có id=${existing[0].id})`);
      continue;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [prod] = await conn.execute(
        `INSERT INTO productions (type, title, slug, description, poster_url, banner_url,
                                  status, release_year, is_premium, country, language)
         VALUES (?, ?, ?, ?, NULL, NULL, 'completed', ?, 0, 'VN', 'vi')`,
        [
          demo.type,
          demo.title,
          demo.slug,
          `Phim demo phát HLS từ Cloudflare R2 (${demo.rawKey}). Dùng để kiểm thử luồng upload → convert → phát.`,
          demo.year,
        ],
      );
      const productionId = prod.insertId;

      // movies/series shell theo đúng mô hình Prisma
      if (demo.type === "movie") {
        await conn.execute("INSERT INTO movies (id, duration) VALUES (?, ?)", [
          productionId,
          demo.duration,
        ]);
      } else {
        await conn.execute("INSERT INTO series (id, total_seasons) VALUES (?, 1)", [productionId]);
      }

      let targetEpisodeProductionId = productionId;
      if (demo.type === "series") {
        // Series: tạo production con cho mùa 1 (đúng mô hình season = production shell)
        const [season] = await conn.execute(
          `INSERT INTO productions (type, title, slug, status, release_year, is_premium, country, language)
           VALUES ('season', ?, ?, 'completed', ?, 0, 'VN', 'vi')`,
          [`${demo.title} - Season 1`, `${demo.slug}-season-1`, demo.year],
        );
        targetEpisodeProductionId = season.insertId;
        await conn.execute(
          "INSERT INTO seasons (id, series_id, season_number, total_episodes) VALUES (?, ?, 1, 1)",
          [targetEpisodeProductionId, productionId],
        );
      }

      await conn.execute(
        `INSERT INTO episodes (production_id, episode_number, title, video_url, duration)
         VALUES (?, 1, ?, ?, ?)`,
        [
          targetEpisodeProductionId,
          demo.type === "movie" ? "Full Movie" : "Tập 1",
          hlsUrl,
          demo.duration,
        ],
      );

      await conn.commit();
      console.log(`  ${demo.title} ... ✓ id=${productionId} (episode ở ${targetEpisodeProductionId})`);
    } catch (error) {
      await conn.rollback();
      console.error(`  ${demo.title} ... ✗ ${error.message}`);
      throw error;
    } finally {
      conn.release();
    }
  }
};

try {
  console.log("Khôi phục phim demo HLS từ R2:\n");
  await run();
  console.log("\n③ Xong.");
} catch (error) {
  console.error("❌ Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
