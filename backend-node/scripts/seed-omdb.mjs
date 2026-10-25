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
  // --- Đã có (APPEND sẽ tự bỏ qua vì trùng slug) ---
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
  // --- Top IMDb mở rộng ---
  { t: "The Shawshank Redemption", type: "movie" },
  { t: "The Godfather Part II", type: "movie" },
  { t: "Pulp Fiction", type: "movie" },
  { t: "Schindler's List", type: "movie" },
  { t: "Se7en", type: "movie" },
  { t: "The Lord of the Rings: The Fellowship of the Ring", type: "movie" },
  { t: "The Lord of the Rings: The Two Towers", type: "movie" },
  { t: "The Lord of the Rings: The Return of the King", type: "movie" },
  { t: "Goodfellas", type: "movie" },
  { t: "City of God", type: "movie" },
  { t: "Life Is Beautiful", type: "movie" },
  { t: "The Departed", type: "movie" },
  { t: "Terminator 2: Judgment Day", type: "movie" },
  { t: "Back to the Future", type: "movie" },
  { t: "Psycho", type: "movie" },
  { t: "WALL-E", type: "movie" },
  { t: "The Lion King", type: "movie" },
  { t: "Aliens", type: "movie" },
  { t: "Django Unchained", type: "movie" },
  { t: "The Prestige", type: "movie" },
  { t: "Joker", type: "movie" },
  { t: "Top Gun: Maverick", type: "movie" },
  { t: "Titanic", type: "movie" },
  { t: "Spider-Man: Into the Spider-Verse", type: "movie" },
  { t: "Deadpool", type: "movie" },
  { t: "Logan", type: "movie" },
  { t: "Casino Royale", type: "movie" },
  { t: "Mad Max: Fury Road", type: "movie" },
  { t: "The Wolf of Wall Street", type: "movie" },
  { t: "1917", type: "movie" },
  { t: "Knives Out", type: "movie" },
  { t: "John Wick", type: "movie" },
  { t: "The Grand Budapest Hotel", type: "movie" },
  { t: "Her", type: "movie" },
  { t: "Inside Out", type: "movie" },
  { t: "Up", type: "movie" },
  { t: "Ratatouille", type: "movie" },
  { t: "Soul", type: "movie" },
  { t: "The Truman Show", type: "movie" },
  { t: "Catch Me If You Can", type: "movie" },
  { t: "Green Book", type: "movie" },
  { t: "Slumdog Millionaire", type: "movie" },
  { t: "500 Days of Summer", type: "movie" },
  { t: "How to Train Your Dragon", type: "movie" },
  { t: "Shrek", type: "movie" },
  { t: "The Dark Knight Rises", type: "movie" },
  { t: "Batman Begins", type: "movie" },
  { t: "Jujutsu Kaisen 0", type: "movie" },
  { t: "Demon Slayer the Movie: Mugen Train", type: "movie" },
  { t: "Suzume", type: "movie" },
  { t: "Weathering with You", type: "movie" },
  { t: "A Silent Voice", type: "movie" },
  { t: "Howl's Moving Castle", type: "movie" },
  { t: "Princess Mononoke", type: "movie" },
  { t: "My Neighbor Totoro", type: "movie" },
  { t: "Bo Gia", type: "movie" },
  { t: "Em va Trinh", type: "movie" },
  { t: "Mai", type: "movie", y: 2024 },
  { t: "Oldboy", type: "movie" },
  { t: "Memories of Murder", type: "movie" },
  { t: "The Handmaiden", type: "movie" },
  { t: "Minari", type: "movie" },
  { t: "Everything Everywhere All at Once", type: "movie" },
  { t: "Avatar", type: "movie" },
  { t: "Avatar: The Way of Water", type: "movie" },
  { t: "Frozen", type: "movie" },
  { t: "Moana", type: "movie" },
  // --- Series mở rộng ---
  { t: "The Office", type: "series" },
  { t: "Brooklyn Nine-Nine", type: "series" },
  { t: "Sherlock", type: "series" },
  { t: "Peaky Blinders", type: "series" },
  { t: "Westworld", type: "series" },
  { t: "Chernobyl", type: "series" },
  { t: "The Queen's Gambit", type: "series" },
  { t: "Narcos", type: "series" },
  { t: "Better Call Saul", type: "series" },
  { t: "The Boys", type: "series" },
  { t: "Invincible", type: "series" },
  { t: "Arcane", type: "series" },
  { t: "Loki", type: "series" },
  { t: "WandaVision", type: "series" },
  { t: "House of Cards", type: "series" },
  { t: "Black Mirror", type: "series" },
  { t: "Mr. Robot", type: "series" },
  { t: "Vikings", type: "series" },
  { t: "The Last Kingdom", type: "series" },
  { t: "Kingdom", type: "series", y: 2019 },
  { t: "Reply 1988", type: "series" },
  { t: "Hospital Playlist", type: "series" },
  { t: "Extraordinary Attorney Woo", type: "series" },
  { t: "Alchemy of Souls", type: "series" },
  { t: "My Mister", type: "series" },
  { t: "Itaewon Class", type: "series" },
  { t: "Goblin", type: "series" },
  { t: "Descendants of the Sun", type: "series" },
  { t: "Hometown Cha-Cha-Cha", type: "series" },
  { t: "Crash Landing on You", type: "series" },
  { t: "Attack on Titan", type: "series" },
  { t: "Death Note", type: "series" },
  { t: "One Punch Man", type: "series" },
  { t: "Hunter x Hunter", type: "series" },
  { t: "Fullmetal Alchemist: Brotherhood", type: "series" },
  { t: "Vinland Saga", type: "series" },
  { t: "Spy x Family", type: "series" },
  { t: "Chainsaw Man", type: "series" },
  { t: "Demon Slayer: Kimetsu no Yaiba", type: "series" },
  { t: "Jujutsu Kaisen", type: "series" },
  { t: "How I Met Your Mother", type: "series" },
  { t: "Two and a Half Men", type: "series" },
  { t: "The Big Bang Theory", type: "series" },
  { t: "Modern Family", type: "series" },
  { t: "Fleabag", type: "series" },
  { t: "Ted Lasso", type: "series" },
  { t: "Severance", type: "series" },
  { t: "The Bear", type: "series" },
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
      const appendMode = process.env.APPEND === "1";
  if (appendMode) {
    console.log("① Chế độ APPEND: giữ dữ liệu hiện có, chỉ nạp thêm phim mới.");
  } else {
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
  }

    // ② Nạp phim/series từ OMDb
    let created = 0;
    let skipped = 0;
    for (const item of TITLES) {
      try {
        if (appendMode) {
          const [dup] = await connection.execute("SELECT id FROM productions WHERE slug = ? LIMIT 1", [slugify(item.t)]);
          if (dup.length) { skipped += 1; continue; }
        }
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
