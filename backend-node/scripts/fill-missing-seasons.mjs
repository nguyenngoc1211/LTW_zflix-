// Bổ sung season + episodes cho các production "vỏ rỗng" (series 0 mùa / 0 tập).
//
// Bối cảnh: seed-omdb bỏ qua một số phim do trùng slug, nhưng production vẫn được
// tạo ra nên tồn tại dưới dạng rỗng.
//
// QUAN TRỌNG: với series CHỈ CÓ 1 MÙA, không được tạo production con cho mùa
// (slug sẽ trùng production gốc -> ER_DUP_ENTRY). Thay vào đó gắn tập trực tiếp
// vào production gốc. Với series nhiều mùa mới tạo production con "Title - Season N".
//
// Chạy: node scripts/fill-missing-seasons.mjs

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url), override: false });
const { pool } = await import("../src/core/database/pool.js");

const OMDB_KEY = process.env.OMDB_API_KEY?.trim();
if (!OMDB_KEY) {
  console.error("❌ Thiếu OMDB_API_KEY trong backend-node/.env");
  process.exit(1);
}

const DEMO_VIDEO = "https://vjs.zencdn.net/v/oceans.mp4";

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200) || "item";

const runtimeToSeconds = (runtime) => {
  const m = /^(\d+)/.exec(String(runtime || ""));
  return m ? Number(m[1]) * 60 : 2700;
};

const omdb = async (params) => {
  const url = new URL("https://www.omdbapi.com/");
  for (const [k, v] of Object.entries({ ...params, apikey: OMDB_KEY })) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// Tạo production con cho một mùa; trả về id
const createSeasonProduction = async (parent, info, season) => {
  const seasonTitle = `${parent.title} - Season ${season}`;
  let slug = slugify(seasonTitle);

  // Đảm bảo slug không đụng bất kỳ production nào đã có
  const [clash] = await pool.execute("SELECT id FROM productions WHERE slug = ? LIMIT 1", [slug]);
  if (clash.length) slug = `${slug}-s${season}-${Date.now().toString(36).slice(-4)}`;

  const [ins] = await pool.execute(
    `INSERT INTO productions (type, title, slug, description, poster_url, banner_url,
                              status, release_year, is_premium, country, language, rating_avg, rating_count)
     VALUES ('season', ?, ?, ?, ?, ?, 'completed', ?, 0, ?, ?, ?, ?)`,
    [
      seasonTitle,
      slug,
      info.Plot && info.Plot !== "N/A" ? info.Plot : null,
      info.Poster && info.Poster !== "N/A" ? info.Poster : null,
      info.Poster && info.Poster !== "N/A" ? info.Poster : null,
      Number(String(info.Year).slice(0, 4)) || null,
      info.Country && info.Country !== "N/A" ? info.Country.split(",")[0].trim() : null,
      info.Language && info.Language !== "N/A" ? info.Language.split(",")[0].trim() : null,
      Number(info.imdbRating) || null,
      Number(String(info.imdbVotes || "0").replace(/,/g, "")) || 0,
    ],
  );
  return ins.insertId;
};

const insertEpisodes = async (productionId, episodes) => {
  let added = 0;
  for (const ep of episodes) {
    const number = Number(ep.Episode) || 0;
    if (!number) continue;
    try {
      await pool.execute(
        `INSERT INTO episodes (production_id, episode_number, title, video_url, duration)
         VALUES (?, ?, ?, ?, ?)`,
        [productionId, number, ep.Title || `Tập ${number}`, DEMO_VIDEO, runtimeToSeconds(ep.Runtime)],
      );
      added += 1;
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY") throw error;
    }
  }
  return added;
};

const main = async () => {
  const [targets] = await pool.execute(`
    SELECT p.id, p.title, p.slug
      FROM productions p
     WHERE p.type = 'series'
       AND NOT EXISTS (SELECT 1 FROM episodes e WHERE e.production_id = p.id)
       AND NOT EXISTS (
             SELECT 1 FROM seasons s JOIN episodes e2 ON e2.production_id = s.id
              WHERE s.series_id = p.id)
     ORDER BY p.id
  `);

  console.log(`Tìm thấy ${targets.length} series rỗng cần bổ sung.\n`);

  let filled = 0;
  let skipped = 0;

  for (const prod of targets) {
    process.stdout.write(`  ${prod.title} ... `);

    let info;
    try {
      info = await omdb({ t: prod.title, type: "series" });
    } catch (error) {
      console.log(`✗ lỗi mạng (${error.message})`);
      skipped += 1;
      continue;
    }
    if (info.Response !== "True" || !info.imdbID) {
      console.log("✗ OMDb không tìm thấy");
      skipped += 1;
      continue;
    }

    const totalSeasons = Math.max(1, Number(info.totalSeasons) || 1);
    let created = 0;

    if (totalSeasons === 1) {
      // 1 mùa: gắn tập trực tiếp vào production gốc (tránh trùng slug)
      let data;
      try {
        data = await omdb({ i: info.imdbID, Season: "1" });
      } catch {
        console.log("✗ không lấy được mùa 1");
        skipped += 1;
        continue;
      }
      const eps = data.Episodes || [];
      if (!eps.length) {
        console.log("✗ mùa 1 rỗng");
        skipped += 1;
        continue;
      }
      created = await insertEpisodes(prod.id, eps);
      await pool.execute("UPDATE series SET total_seasons = 1 WHERE id = ?", [prod.id]);
    } else {
      // Nhiều mùa: tạo production con cho từng mùa
      for (let season = 1; season <= totalSeasons; season += 1) {
        let data;
        try {
          data = await omdb({ i: info.imdbID, Season: String(season) });
        } catch {
          continue;
        }
        const eps = data.Episodes || [];
        if (!eps.length) continue;

        const seasonId = await createSeasonProduction(prod, info, season);
        const [existing] = await pool.execute("SELECT id FROM seasons WHERE id = ?", [seasonId]);
        if (!existing.length) {
          await pool.execute(
            "INSERT INTO seasons (id, series_id, season_number, total_episodes) VALUES (?, ?, ?, ?)",
            [seasonId, prod.id, season, eps.length],
          );
        }
        created += await insertEpisodes(seasonId, eps);
      }
      await pool.execute("UPDATE series SET total_seasons = ? WHERE id = ?", [totalSeasons, prod.id]);
    }

    if (created > 0) {
      console.log(`✓ +${created} tập (${totalSeasons} mùa)`);
      filled += 1;
    } else {
      console.log("✗ không tạo được tập");
      skipped += 1;
    }
  }

  console.log(`\n③ Xong: ${filled} series được bổ sung, ${skipped} bỏ qua.`);
};

try {
  await main();
} catch (error) {
  console.error("❌ Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
