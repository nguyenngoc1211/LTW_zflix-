// Đồng bộ toàn bộ catalog phim theo nội dung thật trên Cloudflare R2.
//
// Quy tắc:
//  - Nguồn sự thật là các thư mục `hls/<id>/playlist.m3u8` trên R2.
//  - Mỗi thư mục HLS tương ứng đúng 1 phim (movie) hoặc 1 tập của phim bộ (series).
//  - Phim không có video R2 sẽ bị xoá khỏi DB (cascade episodes/seasons/...).
//  - Poster + banner được trích từ chính video bằng ffmpeg rồi upload lại R2,
//    nhờ vậy không phụ thuộc link ngoài (OMDb, fbcdn...) có thể hết hạn.
//
// Mặc định chỉ in kế hoạch (dry-run). Thêm `--apply` mới ghi DB/R2.
// Nếu một thư mục HLS được dùng cho nhiều production (catalog init.sql xoay vòng
// video giữa các phim), script bỏ qua thư mục đó để không ghi đè dữ liệu.
// Dùng `--allow-shared-videos` nếu thật sự muốn ép đồng bộ.
//
// Chạy: node scripts/sync-catalog-from-r2.mjs [--apply] [--no-posters] [--allow-shared-videos]

import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url), override: false });

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { pool } = await import("../src/core/database/pool.js");
const { default: s3 } = await import("../src/core/storage/r2.js");
const { ListObjectsV2Command, PutObjectCommand } = await import("@aws-sdk/client-s3");

const APPLY = process.argv.includes("--apply");
const NO_POSTERS = process.argv.includes("--no-posters");
const ALLOW_SHARED = process.argv.includes("--allow-shared-videos");

const PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || "").replace(/\/+$/, "");
const BUCKET = process.env.R2_BUCKET_NAME;

if (!PUBLIC_DOMAIN || !BUCKET) {
  console.error("❌ Thiếu R2_PUBLIC_DOMAIN hoặc R2_BUCKET_NAME trong backend-node/.env");
  process.exit(1);
}

// Metadata cho từng thư mục HLS — dùng khi DB chưa có production nào gắn với
// thư mục đó (DB mới import init.sql, hoặc thư mục vừa upload). Nếu DB đã có
// episode trỏ tới thư mục thì luôn giữ dữ liệu admin đã đặt (title/is_premium).
const KNOWN_DIRS = {
  "1792479683719-545": {
    slug: "phim-demo-nam-le-hls-r2",
    title: "Phim Demo Nam — Lẻ (HLS R2)",
    type: "movie",
    description:
      "Phim demo phát HLS từ Cloudflare R2 (raw/movies/1792479683719-545.mp4). Dùng để kiểm thử luồng upload → convert → phát.",
  },
  "1792480481546-125": {
    slug: "phim-demo-nam-bo-hls-r2",
    title: "Phim Demo Nam — Bộ (HLS R2)",
    type: "series",
    description:
      "Phim demo phát HLS từ Cloudflare R2 (raw/movies/1792480481546-125.mp4). Dùng để kiểm thử luồng upload → convert → phát.",
  },
  "1793187369777-494": {
    slug: "tedstdre",
    title: "tédstdre",
    type: "movie",
    description: "sưerwe",
  },
  "1793193346988-392": {
    slug: "phim-demo-ngan-hls-r2",
    title: "Phim Demo Ngắn (HLS R2)",
    type: "movie",
  },
  "1793197577242-913": {
    slug: "anh-lam",
    title: "anh lam",
    type: "movie",
    is_premium: 1,
  },
  "1793200804811-397": {
    slug: "nhan-dien-o-vat",
    title: "nhận diện đồ vật",
    type: "movie",
    is_premium: 1,
    description: "test chức năng nhận diện đồ vật",
  },
};

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const listHlsDirs = async () => {
  const out = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "hls/", Delimiter: "/" }),
  );
  return (out.CommonPrefixes || [])
    .map((item) => item.Prefix)
    .filter((prefix) => /^hls\/[^/]+\/$/.test(prefix));
};

const readPlaylist = async (dir) => {
  const url = `${PUBLIC_DOMAIN}/hls/${dir}/playlist.m3u8`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`playlist ${response.status}`);
  const text = await response.text();
  const durations = [...text.matchAll(/^#EXTINF:\s*([\d.]+)/gm)].map((match) => Number(match[1]));
  if (!durations.length) throw new Error("playlist không có segment");
  return { url, duration: Math.max(1, Math.round(durations.reduce((a, b) => a + b, 0))), segments: durations.length };
};

const resolveProduction = async (dir) => {
  const [rows] = await pool.execute(
    `SELECT DISTINCT e.production_id, p.type, s.series_id
       FROM episodes e
       JOIN productions p ON p.id = e.production_id
       LEFT JOIN seasons s ON s.id = e.production_id
      WHERE e.video_url LIKE ?`,
    [`%${dir}%`],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    productionId: row.type === "season" && row.series_id ? row.series_id : row.production_id,
    episodeProductionId: row.production_id,
    ambiguous: rows.length > 1,
  };
};

const makeFrame = async ({ url, seek, width, output }) => {
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-ss", String(seek),
      "-i", url,
      "-frames:v", "1",
      "-vf", `scale=${width}:-2`,
      "-q:v", "3",
      output,
    ],
    { timeout: 120000 },
  );
  return readFile(output);
};

const uploadPosterPair = async ({ dir, url, duration, workDir }) => {
  const seek = Math.max(1, Math.min(30, Math.floor(duration * 0.3)));
  const posterPath = path.join(workDir, `${dir}-poster.jpg`);
  const bannerPath = path.join(workDir, `${dir}-banner.jpg`);
  const [poster, banner] = await Promise.all([
    makeFrame({ url, seek, width: 640, output: posterPath }),
    makeFrame({ url, seek, width: 1280, output: bannerPath }),
  ]);
  const posterKey = `posters/hls/${dir}-poster.jpg`;
  const bannerKey = `posters/hls/${dir}-banner.jpg`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: posterKey, Body: poster, ContentType: "image/jpeg" }));
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: bannerKey, Body: banner, ContentType: "image/jpeg" }));
  return {
    posterUrl: `${PUBLIC_DOMAIN}/${posterKey}`,
    bannerUrl: `${PUBLIC_DOMAIN}/${bannerKey}`,
  };
};

const plan = async () => {
  const prefixes = await listHlsDirs();
  const items = [];
  for (const prefix of prefixes) {
    const dir = prefix.replace(/^hls\//, "").replace(/\/$/, "");
    const playlist = await readPlaylist(dir);
    const match = await resolveProduction(dir);
    const known = KNOWN_DIRS[dir] || null;

    if (match?.ambiguous && !ALLOW_SHARED) {
      console.warn(
        `hls/${dir} | ${playlist.duration}s | dùng cho nhiều production — bỏ qua (thêm --allow-shared-videos để ép đồng bộ)`,
      );
      continue;
    }

    let production = null;
    if (match) {
      const [rows] = await pool.execute(
        "SELECT id, type, title, slug, is_premium FROM productions WHERE id = ? LIMIT 1",
        [match.productionId],
      );
      if (rows.length) {
        production = rows[0];
      }
    }
    if (!production && known?.slug) {
      const [rows] = await pool.execute(
        "SELECT id, type, title, slug, is_premium FROM productions WHERE slug = ? LIMIT 1",
        [known.slug],
      );
      if (rows.length) production = rows[0];
    }

    items.push({
      dir,
      ...playlist,
      production,
      isNew: !production,
      known,
      matchedEpisodeProductionId: match?.episodeProductionId ?? null,
    });
  }
  return items;
};

const ensureShell = async (conn, { production, dir, duration, matchedEpisodeProductionId }) => {
  if (production.type === "series") {
    await conn.execute(
      "INSERT INTO series (id, total_seasons) VALUES (?, 1) ON DUPLICATE KEY UPDATE total_seasons = GREATEST(total_seasons, 1)",
      [production.id],
    );
    if (matchedEpisodeProductionId) {
      const [matched] = await conn.execute(
        "SELECT id FROM seasons WHERE id = ? AND series_id = ? LIMIT 1",
        [matchedEpisodeProductionId, production.id],
      );
      if (matched.length) return matchedEpisodeProductionId;
    }
    const [seasonRows] = await conn.execute(
      "SELECT id FROM seasons WHERE series_id = ? AND season_number = 1 LIMIT 1",
      [production.id],
    );
    let seasonId = seasonRows[0]?.id;
    if (!seasonId) {
      const [season] = await conn.execute(
        `INSERT INTO productions (type, title, slug, status, release_year, is_premium, country, language)
         VALUES ('season', ?, ?, 'completed', 2026, 0, 'VN', 'vi')`,
        [`${production.title} - Season 1`, `${production.slug}-season-1`],
      );
      seasonId = season.insertId;
      await conn.execute(
        "INSERT INTO seasons (id, series_id, season_number, total_episodes) VALUES (?, ?, 1, 1)",
        [seasonId, production.id],
      );
    }
    return seasonId;
  }

  await conn.execute(
    "INSERT INTO movies (id, duration) VALUES (?, ?) ON DUPLICATE KEY UPDATE duration = VALUES(duration)",
    [production.id, duration],
  );
  return production.id;
};

const upsertEpisode = async (conn, { dir, url, duration, production, episodeProductionId }) => {
  const [rows] = await conn.execute(
    "SELECT id FROM episodes WHERE production_id = ? AND video_url LIKE ? LIMIT 1",
    [episodeProductionId, `%${dir}%`],
  );
  if (rows.length) {
    await conn.execute(
      "UPDATE episodes SET video_url = ?, duration = ? WHERE id = ?",
      [url, duration, rows[0].id],
    );
    return { action: "cập nhật", id: rows[0].id };
  }

  const [countRows] = await conn.execute(
    "SELECT COUNT(*) AS total FROM episodes WHERE production_id = ?",
    [episodeProductionId],
  );
  const episodeNumber = Number(countRows[0].total) + 1;
  const [result] = await conn.execute(
    `INSERT INTO episodes (production_id, episode_number, title, video_url, duration)
     VALUES (?, ?, ?, ?, ?)`,
    [
      episodeProductionId,
      episodeNumber,
      production.type === "series" ? `Tập ${episodeNumber}` : "Full Movie",
      url,
      duration,
    ],
  );
  return { action: "tạo mới", id: result.insertId, episodeNumber };
};

const createProduction = async (conn, { dir, known }) => {
  const spec = known?.slug
    ? known
    : { slug: `phim-r2-${dir}`, title: `Phim R2 ${dir}`, type: "movie" };
  const [result] = await conn.execute(
    `INSERT INTO productions (type, title, slug, description, status, release_year, is_premium, country, language)
     VALUES (?, ?, ?, ?, 'completed', 2026, ?, 'VN', 'vi')`,
    [
      spec.type,
      spec.title,
      spec.slug || slugify(spec.title),
      spec.description || "Phim phát trực tuyến từ Cloudflare R2 (HLS).",
      spec.is_premium ? 1 : 0,
    ],
  );
  return { id: result.insertId, type: spec.type, title: spec.title, slug: spec.slug || slugify(spec.title), is_premium: spec.is_premium ? 1 : 0 };
};

const main = async () => {
  console.log(`Chế độ: ${APPLY ? "APPLY (ghi dữ liệu)" : "DRY-RUN (chỉ in kế hoạch)"}\n`);

  const items = await plan();
  const workDir = APPLY && !NO_POSTERS ? await mkdtemp(path.join(tmpdir(), "zflix-posters-")) : null;

  const summaries = [];
  try {
    for (const item of items) {
      const name = item.production ? `#${item.production.id} "${item.production.title}"` : "(mới)";
      console.log(
        `hls/${item.dir} | ${item.duration}s | ${item.segments} segment | ${name}${item.isNew ? ` → "${item.known?.title || `Phim R2 ${item.dir}`}"` : ""}`,
      );
      if (!APPLY) continue;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const production = item.production || (await createProduction(conn, item));
        if (!item.production) {
          item.production = production;
          item.isNew = true;
        }
        const episodeProductionId = await ensureShell(conn, {
          production,
          dir: item.dir,
          duration: item.duration,
          matchedEpisodeProductionId: item.matchedEpisodeProductionId,
        });
        const episode = await upsertEpisode(conn, {
          dir: item.dir,
          url: item.url,
          duration: item.duration,
          production,
          episodeProductionId,
        });

        let posterUrl = null;
        let bannerUrl = null;
        if (!NO_POSTERS) {
          ({ posterUrl, bannerUrl } = await uploadPosterPair({
            dir: item.dir,
            url: item.url,
            duration: item.duration,
            workDir,
          }));
          await conn.execute("UPDATE productions SET poster_url = ?, banner_url = ? WHERE id = ?", [
            posterUrl,
            bannerUrl,
            production.id,
          ]);
        }

        await conn.commit();
        summaries.push({ productionId: production.id, type: production.type });
        console.log(
          `  ✓ episode ${episode.action} (id=${episode.id})${posterUrl ? " + poster/banner R2" : ""}`,
        );
      } catch (error) {
        await conn.rollback();
        throw new Error(`hls/${item.dir}: ${error.message}`);
      } finally {
        conn.release();
      }
    }
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }

  // ---- Dọn catalog: chỉ giữ production gắn với video R2 ----
  const keepIds = (await pool.execute(
    `SELECT DISTINCT COALESCE(s.series_id, e.production_id) AS id
       FROM episodes e
       LEFT JOIN seasons s ON s.id = e.production_id
      WHERE e.video_url LIKE ?`,
    [`${PUBLIC_DOMAIN}/hls/%`],
  ))[0].map((row) => row.id);

  if (!APPLY) {
    const [[{ total }]] = await pool.execute("SELECT COUNT(*) AS total FROM productions WHERE type IN ('movie','series')");
    console.log(`\nSẽ giữ ${keepIds.length} phim có video R2, xoá ${Math.max(0, total - keepIds.length)} phim còn lại (cascade).`);
    const [[setting]] = await pool.execute("SELECT setting_value FROM app_settings WHERE setting_key = 'featured_production_id' LIMIT 1");
    console.log(`Featured hiện tại: ${setting?.setting_value ?? "(chưa đặt)"} — sẽ trỏ về phim R2 đầu tiên nếu không hợp lệ.`);
    console.log("\nChạy lại với --apply để thực thi.");
    return;
  }

  if (!keepIds.length) throw new Error("Không có production nào để giữ — huỷ để tránh xoá sạch DB.");

  const [seasonRows] = await pool.query("SELECT id FROM seasons WHERE series_id IN (?)", [keepIds]);
  const keepSeasonIds = seasonRows.map((row) => row.id);

  if (keepSeasonIds.length) {
    await pool.query("DELETE FROM productions WHERE type = 'season' AND id NOT IN (?)", [keepSeasonIds]);
  } else {
    await pool.query("DELETE FROM productions WHERE type = 'season'");
  }

  const [deleted] = await pool.query(
    "DELETE FROM productions WHERE type IN ('movie','series') AND id NOT IN (?)",
    [keepIds],
  );
  console.log(`Đã xoá ${deleted.affectedRows} production không có video R2.`);

  const [[{ kept }]] = await pool.execute("SELECT COUNT(*) AS kept FROM productions WHERE type IN ('movie','series')");
  console.log(`Catalog còn lại: ${kept} phim.`);

  // ---- Featured phải trỏ tới phim còn tồn tại ----
  const [[featured]] = await pool.execute("SELECT setting_value FROM app_settings WHERE setting_key = 'featured_production_id' LIMIT 1");
  const featuredId = featured ? Number(featured.setting_value) : null;
  const valid = featuredId && keepIds.includes(featuredId);
  if (!valid) {
    const [rows] = await pool.execute(
      "SELECT id FROM productions WHERE type IN ('movie','series') ORDER BY is_premium ASC, id ASC LIMIT 1",
    );
    const nextId = rows[0]?.id ?? null;
    if (nextId) {
      await pool.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('featured_production_id', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(nextId)],
      );
    } else {
      await pool.execute("DELETE FROM app_settings WHERE setting_key = 'featured_production_id'");
    }
    console.log(`Featured: ${featuredId ?? "(trống)"} → ${nextId ?? "(trống)"}`);
  } else {
    console.log(`Featured: #${featuredId} vẫn hợp lệ.`);
  }

  // ---- Elasticsearch: xoá index cũ rồi đánh lại (nếu đang chạy) ----
  try {
    const { syncProductionIndex } = await import("../src/modules/discovery/search.service.js");
    const esUrl = (process.env.ELASTICSEARCH_URL || "http://elasticsearch:9200").replace(/\/$/, "");
    const index = process.env.ELASTICSEARCH_INDEX || "productions";
    const response = await fetch(`${esUrl}/${index}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(5000),
    });
    console.log(`Elasticsearch index reset: HTTP ${response.status}`);
    const count = await syncProductionIndex();
    console.log(`Elasticsearch reindex: ${count} phim.`);
  } catch (error) {
    console.log(`Elasticsearch bỏ qua: ${error.message}`);
  }

  console.log("\n✓ Đồng bộ catalog từ R2 hoàn tất.");
};

try {
  await main();
} catch (error) {
  console.error(`\n❌ Lỗi: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
