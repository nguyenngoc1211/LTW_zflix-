// Nạp dữ liệu phim THẬT từ OMDb API thay thế dữ liệu seed giả.
// Video gán vào tập là các open movie/sample hợp pháp (Blender + Google sample bucket).
// Chạy: npm run seed:omdb
//
// Cần trong backend-node/.env:  OMDB_API_KEY=...
// Lưu ý: script XÓA nội dung content tables (phim/tập/genre/đánh giá/bình luận...)
// và GIỮ nguyên tài khoản người dùng (users, auth_sessions...).

import "dotenv/config";
import { pool } from "../src/core/database/pool.js";

const OMDB_KEY = process.env.OMDB_API_KEY?.trim();
if (!OMDB_KEY) {
  console.error("❌ Thiếu OMDB_API_KEY trong backend-node/.env (lấy tại omdbapi.com/apikey.aspx)");
  process.exit(1);
}

// Danh sách phim/series nổi tiếng (đều có trên OMDb)
const TITLES = [
  { t: "Inception", type: "movie" },
  { t: "The Dark Knight", type: "movie" },
  { t: "Interstellar", type: "movie" },
  { t: "Parasite", type: "movie", y: 2019 },
  { t: "Avengers: Endgame", type: "movie" },
  { t: "Spirited Away", type: "movie" },
  { t: "Your Name", type: "movie", y: 2016 },
  { t: "Train to Busan", type: "movie" },
  { t: "The Matrix", type: "movie" },
  { t: "Forrest Gump", type: "movie" },
  { t: "Gladiator", type: "movie", y: 2000 },
  { t: "The Godfather", type: "movie" },
  { t: "Fight Club", type: "movie" },
  { t: "La La Land", type: "movie" },
  { t: "Coco", type: "movie", y: 2017 },
  { t: "Toy Story", type: "movie" },
  { t: "Oppenheimer", type: "movie" },
  { t: "Dune", type: "movie", y: 2021 },
  { t: "Spider-Man: No Way Home", type: "movie" },
  { t: "Whiplash", type: "movie" },
  { t: "Breaking Bad", type: "series" },
  { t: "Stranger Things", type: "series" },
  { t: "Game of Thrones", type: "series" },
  { t: "Friends", type: "series" },
  { t: "The Witcher", type: "series" },
  { t: "Money Heist", type: "series" },
  { t: "The Last of Us", type: "series" },
  { t: "Squid Game", type: "series" },
  { t: "Dark", type: "series", y: 2017 },
  { t: "The Mandalorian", type: "series" },
];

// Video demo hợp pháp (Blender open movies CC-BY + Archive.org public domain)
// Đã curl xác minh từng URL HTTP 200 trước khi dùng.
const VIDEO_POOL = [
  "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.vp9.webm",
  "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4",
  "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4",
  "https://archive.org/download/Sintel/sintel-2048-surround_512kb.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4",
];
const videoFor = (index) => VIDEO_POOL[index % VIDEO_POOL.length];

const runtimeToSeconds = (runtime) => {
  const m = /(\d+)h\s*(\d+)?/.exec(runtime || "");
  if (m) return (Number(m[1]) * 60 + Number(m[2] || 0)) * 60;
  const mins = /(\d+)\s*min/.exec(runtime || "");
  return mins ? Number(mins[1]) * 60 : 2700;
};

const slugify = (title) =>
  title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "phim";

const omdbFetch = async (params) => {
  const search = new URLSearchParams({ apikey: OMDB_KEY, ...params });
  const res = await fetch(`https://www.omdbapi.com/?${search}`, { signal: AbortSignal.timeout(15000) });
  const json = await res.json();
  if (json.Response !== "True") throw new Error(json.Error || `OMDb ${res.status}`);
  return json;
};

const GENRE_MAP = {
  Action: "Hành động", Adventure: "Phiêu lưu", Animation: "Hoạt hình", Biography: "Chân dung",
  Comedy: "Hài hước", Crime: "Tội phạm", Documentary: "Tài liệu", Drama: "Kịch tính",
  Family: "Gia đình", Fantasy: "Giả tưởng", History: "Lịch sử", Horror: "Kinh dị",
  Music: "Âm nhạc", Musical: "Âm nhạc", Mystery: "Bí ẩn", Romance: "Tình cảm",
  "Sci-Fi": "Viễn tưởng", "Science Fiction": "Viễn tưởng", Short: "Ngắn", Sport: "Thể thao",
  Thriller: "Hồi hộp", War: "Chiến tranh", Western: "Cao bồi",
};

const fetchSeason = async (imdbId, season) => {
  const json = await omdbFetch({ i: imdbId, Season: String(season) });
  return (json.Episodes || []).map((ep) => ({
    number: Number(ep.Episode),
    title: ep.Title,
    runtime: runtimeToSeconds(ep.Runtime),
  }));
};

const main = async () => {
  const connection = await pool.getConnection();
  try {
    console.log("① Xóa dữ liệu content cũ (giữ nguyên users)...");
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "production_products", "product_snapshots", "watch_party_chats", "watch_party_participants",
      "watch_parties", "notifications", "comments", "comment_likes", "ratings", "bookmarks",
      "production_interests", "watch_history", "transactions", "user_subscriptions",
      "episodes", "seasons", "series", "movies", "production_actors", "production_genres",
      "productions", "genres", "actors", "daily_stats",
    ]) {
      await connection.query(`TRUNCATE TABLE ${table}`);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("   ✓ sạch");

    // ② Nạp phim/series từ OMDb
    let created = 0;
    let skipped = 0;
    for (const item of TITLES) {
      try {
        const omdb = await omdbFetch(item.y ? { t: item.t, y: item.y } : { t: item.t });
        const title = omdb.Title;
        const isSeries = omdb.Type === "series";
        const poster = omdb.Poster && omdb.Poster !== "N/A" ? omdb.Poster : null;
        const description = omdb.Plot && omdb.Plot !== "N/A" ? omdb.Plot : null;
        const year = (omdb.Year || "").split("–")[0] || null;
        const country = (omdb.Country || "").split(",")[0].trim() || null;
        const language = (omdb.Language || "").split(",")[0].trim() || null;
        const ratingAvg = Number(omdb.imdbRating) || 0;
        const ratingCount = Number((omdb.imdbVotes || "0").replace(/,/g, "")) || 0;
        const runtimeSec = runtimeToSeconds(omdb.Runtime);

        const [prodResult] = await connection.execute(
          `INSERT INTO productions (type, title, slug, description, poster_url, banner_url, status, release_year, is_premium, country, language, rating_avg, rating_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [isSeries ? "series" : "movie", title, slugify(title), description, poster, poster, "completed", Number(year) || null, country, language, ratingAvg, ratingCount],
        );
        const productionId = prodResult.insertId;

        // Thể loại
        const genres = (omdb.Genre || "").split(",").map((g) => g.trim()).filter(Boolean);
        for (const genreEn of genres) {
          const genreVn = GENRE_MAP[genreEn] || genreEn;
          const [rows] = await connection.execute("SELECT id FROM genres WHERE name = ? LIMIT 1", [genreVn]);
          let genreId = rows[0]?.id;
          if (!genreId) {
            const [g] = await connection.execute("INSERT INTO genres (name, slug) VALUES (?, ?)", [genreVn, slugify(genreVn)]);
            genreId = g.insertId;
          }
          await connection.execute(
            "INSERT IGNORE INTO production_genres (production_id, genre_id) VALUES (?, ?)",
            [productionId, genreId],
          );
        }

        // Tập phim
        if (isSeries) {
          // Model gốc của DB: series cha (bảng series) + mỗi mùa là 1 production riêng,
          // seasons.id = production id của mùa đó (tham chiếu cả productions lẫn series)
          const totalSeasons = Number(omdb.totalSeasons) || 1;
          const seasonToLoad = Math.min(totalSeasons, 2); // nạp tối đa 2 mùa cho nhẹ
          await connection.execute(
            "INSERT INTO series (id, total_seasons) VALUES (?, ?)",
            [productionId, totalSeasons],
          );
          let episodeIndex = 0;
          for (let season = 1; season <= seasonToLoad; season += 1) {
            let episodes = [];
            try {
              episodes = await fetchSeason(omdb.imdbID, season);
            } catch {
              continue;
            }
            if (!episodes.length) continue;
            const seasonTitle = totalSeasons > 1 ? `${title} - Season ${season}` : title;
            const [seasonProd] = await connection.execute(
              `INSERT INTO productions (type, title, slug, description, poster_url, banner_url, status, release_year, is_premium, country, language, rating_avg, rating_count)
               VALUES ('series', ?, ?, ?, ?, ?, 'completed', ?, 0, ?, ?, ?, ?)`,
              [seasonTitle, slugify(seasonTitle), description, poster, poster, Number(year) || null, country, language, ratingAvg, ratingCount],
            );
            await connection.execute(
              "INSERT INTO seasons (id, series_id, season_number, total_episodes) VALUES (?, ?, ?, ?)",
              [seasonProd.insertId, productionId, season, episodes.length],
            );
            for (const ep of episodes) {
              episodeIndex += 1;
              await connection.execute(
                `INSERT INTO episodes (production_id, episode_number, title, video_url, duration)
                 VALUES (?, ?, ?, ?, ?)`,
                [seasonProd.insertId, ep.number, ep.title, videoFor(episodeIndex + created), ep.runtime],
              );
            }
          }
          console.log(`  ✓ [series] ${title} (${year}) — ${totalSeasons} mùa, IMDb ${omdb.imdbRating}`);
        } else {
          await connection.execute(
            `INSERT INTO episodes (production_id, episode_number, title, video_url, duration)
             VALUES (?, 1, 'Full Movie', ?, ?)`,
            [productionId, videoFor(created), runtimeSec],
          );
          console.log(`  ✓ [movie] ${title} (${year}) — IMDb ${omdb.imdbRating}, ${Math.round(runtimeSec / 60)} phút`);
        }
        created += 1;
      } catch (error) {
        skipped += 1;
        console.log(`  ✗ bỏ qua "${item.t}": ${error.message}`);
      }
    }

    console.log(`\n③ Xong: ${created} productions nạp mới, ${skipped} bỏ qua.`);
    console.log("   Video demo: Blender/Google open movies (hợp pháp, miễn phí).");
    console.log("   Poster: URL từ OMDb (m.media-amazon.com).");
  } finally {
    connection.release();
  }
  await pool.end();
};

main().catch((error) => {
  console.error("SEED LỖI:", error.message);
  process.exit(1);
});
