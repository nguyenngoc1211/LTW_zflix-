import prisma from "../../../core/database/prisma.js";
import {
  deleteFilesFromR2,
  uploadFileToR2,
} from "../../../core/storage/upload.helper.js";
import axios from "axios";

const generateCleanSlug = (title) => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Xóa dấu tiếng Việt
    .replace(/[^a-z0-9]+/g, "-") // Thay khoảng trắng và ký tự đặc biệt bằng dấu gạch ngang
    .replace(/(^-|-$)+/g, ""); // Xóa gạch ngang ở đầu và cuối
};

export const uploadMovieService = async (file, metadata) => {
  const {
    title,
    description,
    release_year,
    is_premium,
    type,
    poster_url,
    banner_url,
    country,
    language,
    genres,
    actors,
    duration,
  } = metadata;

  // 1. Upload video gốc lên R2
  let fileName = null;
  if (file) {
    fileName = await uploadFileToR2(file, "raw/movies");
  }

  // 2. Tạo Slug đẹp không chứa Date.now()
  const slug = generateCleanSlug(title);
  let firstEpisodeId = null;

  // 3. Lưu toàn bộ dữ liệu vào DB
  const newProduction = await prisma.$transaction(async (tx) => {
    // Tạo Vỏ Phim
    const production = await tx.productions.create({
      data: {
        title,
        slug,
        description,
        type: type || "movie",
        release_year: release_year ? parseInt(release_year) : null,
        is_premium: is_premium === "true" || is_premium === true,
        status: metadata.status || "ongoing",
        poster_url: poster_url || null,
        banner_url: banner_url || null,
        country: country || null,
        language: language || null,
      },
    });

    // Lưu Thể loại (Genres)
    if (genres) {
      const genreIds = typeof genres === "string" ? JSON.parse(genres) : genres;
      if (genreIds.length > 0) {
        await tx.production_genres.createMany({
          data: genreIds.map((gId) => ({
            production_id: production.id,
            genre_id: Number(gId),
          })),
        });
      }
    }

    // Lưu Diễn viên (Actors)
    if (actors) {
      const actorList =
        typeof actors === "string" ? JSON.parse(actors) : actors;
      for (const [index, actor] of actorList.entries()) {
        const actorSlug = generateCleanSlug(actor.name) + "-" + Date.now();
        let dbActor = await tx.actors.findFirst({
          where: { name: actor.name },
        });

        if (!dbActor) {
          dbActor = await tx.actors.create({
            data: {
              name: actor.name,
              slug: actorSlug,
              avatar_url: actor.avatar_url,
            },
          });
        } else {
          if (actor.avatar_url && actor.avatar_url !== dbActor.avatar_url) {
            dbActor = await tx.actors.update({
              where: { id: dbActor.id },
              data: { avatar_url: actor.avatar_url },
            });
          }
        }
        await tx.production_actors.create({
          data: {
            production_id: production.id,
            actor_id: dbActor.id,
            character_name: actor.character,
            display_order: index,
          },
        });
      }
    }

    // Tạo Tập phim và Lưu Thời lượng
    if (type === "movie" || !type) {
      const movieDuration = duration ? parseInt(duration) : 0;

      await tx.movies.create({
        data: { id: production.id, duration: movieDuration },
      });

      const episode = await tx.episodes.create({
        data: {
          production_id: production.id,
          episode_number: 1,
          title: "Full Movie",
          video_url: fileName,
          duration: movieDuration, // Đã tính bằng giây từ frontend
        },
      });
      firstEpisodeId = episode.id;
    } else if (type === "series") {
      // Khởi tạo bảng Series với 0 season
      await tx.series.create({
        data: { id: production.id, total_seasons: 0 },
      });
    }
    return production;
  });

  // 4. Gọi Python xử lý Video ngầm
  if (firstEpisodeId && fileName) {
    console.log(`🔥 Đã lưu DB. Đang gửi file ${fileName} sang Python xử lý...`);
    axios
      .post("http://video_service:8001/process-video", {
        file_name: fileName,
        production_id: newProduction.id,
        episode_id: firstEpisodeId,
      })
      .catch((err) => console.error("⚠️ Lỗi gọi Python:", err.message));
  } else {
    console.log(
      "⚠️ Cảnh báo: Không có file video được tải lên, bỏ qua bước gọi Python.",
    );
  }

  return newProduction;
};

export const updateProductionService = async (id, metadata) => {
  const {
    title,
    description,
    release_year,
    is_premium,
    status,
    genres,
    actors,
    poster_url,
    banner_url,
    country,
    language,
    duration, // BỔ SUNG DURATION VÀO ĐÂY
  } = metadata;

  return await prisma.$transaction(async (tx) => {
    const updateData = { updated_at: new Date() };

    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;
    if (release_year !== undefined)
      updateData.release_year = parseInt(release_year);
    if (is_premium !== undefined)
      updateData.is_premium = is_premium === "true" || is_premium === true;
    if (poster_url !== undefined) updateData.poster_url = poster_url;
    if (banner_url !== undefined) updateData.banner_url = banner_url;
    if (country !== undefined) updateData.country = country;
    if (language !== undefined) updateData.language = language;

    // 1. Cập nhật bảng Productions (Lớp vỏ)
    const updated = await tx.productions.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // 2. Cập nhật bảng Movies (Thời lượng)
    // Nếu có gửi duration lên, ta update vào bảng movies
    if (duration !== undefined) {
      // Dùng upsert đề phòng trường hợp phim cũ bị lỗi chưa có record trong bảng movies
      await tx.movies.upsert({
        where: { id: Number(id) },
        update: { duration: parseInt(duration) },
        create: { id: Number(id), duration: parseInt(duration) },
      });

      // Đồng thời cập nhật thời lượng cho tập 1 của phim lẻ đó
      await tx.episodes.updateMany({
        where: { production_id: Number(id), episode_number: 1 },
        data: { duration: parseInt(duration) }, // Frontend đã gửi lên bằng giây
      });
    }

    // 3. Genres (Giữ nguyên logic của bạn)
    if (genres) {
      const genreIds = typeof genres === "string" ? JSON.parse(genres) : genres;
      await tx.production_genres.deleteMany({
        where: { production_id: Number(id) },
      });
      if (genreIds.length > 0) {
        await tx.production_genres.createMany({
          data: genreIds.map((gId) => ({
            production_id: Number(id),
            genre_id: Number(gId),
          })),
        });
      }
    }

    // 4. Actors (Cập nhật dùng Clean Slug)
    if (actors) {
      const actorList =
        typeof actors === "string" ? JSON.parse(actors) : actors;
      await tx.production_actors.deleteMany({
        where: { production_id: Number(id) },
      });

      for (const [index, actor] of actorList.entries()) {
        const slug = generateCleanSlug(actor.name) + "-" + Date.now(); // Dùng Clean Slug

        let dbActor = await tx.actors.findFirst({
          where: { name: actor.name },
        });

        if (!dbActor) {
          dbActor = await tx.actors.create({
            data: { name: actor.name, slug, avatar_url: actor.avatar_url },
          });
        } else {
          if (actor.avatar_url && actor.avatar_url !== dbActor.avatar_url) {
            dbActor = await tx.actors.update({
              where: { id: dbActor.id },
              data: { avatar_url: actor.avatar_url },
            });
          }
        }

        await tx.production_actors.create({
          data: {
            production_id: Number(id),
            actor_id: dbActor.id,
            character_name: actor.character,
            display_order: index,
          },
        });
      }
    }
    return updated;
  });
};

export const deleteProductionService = async (id) => {
  // 1. Lấy thông tin phim và các tập để biết đường dẫn file
  const production = await prisma.productions.findUnique({
    where: { id: Number(id) },
    include: { 
      episodes: true,
      series: {
        include: {
          seasons: {
            include: {
              productions: {
                include: { episodes: true }
              }
            }
          }
        }
      }
    },
  });

  if (!production) throw new Error("Phim không tồn tại!");

  // Gom tất cả các tập của phim (nếu là series thì gom tất cả tập từ tất cả season)
  const allEpisodes = [];
  if (production.episodes) allEpisodes.push(...production.episodes);
  
  const seasonShellIds = [];
  if (production.series?.seasons) {
    for (const season of production.series.seasons) {
      seasonShellIds.push(season.id);
      if (season.productions?.episodes) {
        allEpisodes.push(...season.productions.episodes);
      }
    }
  }

  // 2. Gom các lệnh dọn dẹp kho Cloudflare R2
  const R2_DOMAIN = process.env.R2_PUBLIC_DOMAIN;
  const deletePromises = [];

  // Xóa các file Video (Tìm trong tất cả các tập của phim/season)
  if (allEpisodes.length > 0) {
    allEpisodes.forEach((ep) => {
      if (ep.video_url) {
        let baseFileName = "";

        // Trường hợp 1: DB lưu link HLS (Webhook đã update thành công)
        if (
          ep.video_url.includes(R2_DOMAIN) &&
          ep.video_url.includes(".m3u8")
        ) {
          const urlWithoutDomain = ep.video_url.replace(`${R2_DOMAIN}/`, "");
          const folderPrefix = urlWithoutDomain.replace("playlist.m3u8", ""); // VD: hls/123/
          deletePromises.push(deleteFilesFromR2(folderPrefix));

          // Suy luận ra tên file gốc để xóa rác: "hls/123/" -> "123"
          const parts = folderPrefix.split("/");
          baseFileName = parts[parts.length - 2];
        }
        // Trường hợp 2: DB lưu link RAW (Webhook bị lỗi hoặc chưa kịp chạy)
        else if (ep.video_url.startsWith("raw/")) {
          deletePromises.push(deleteFilesFromR2(ep.video_url));

          // Suy luận ra thư mục HLS: "raw/movies/123.mp4" -> "123"
          const fileNameWithExt = ep.video_url.split("/").pop();
          baseFileName = fileNameWithExt.split(".")[0];
        }

        // BẮT BUỘC: Xóa chéo tàn dư dựa trên baseFileName vừa suy luận được
        if (baseFileName) {
          // Xóa thư mục HLS (Phòng khi Python đã cắt xong nhưng DB chưa nhận được m3u8)
          deletePromises.push(deleteFilesFromR2(`hls/${baseFileName}/`));

          // Xóa file mp4 gốc (Phòng khi DB đã nhận m3u8 nhưng file mp4 gốc vẫn còn nằm trên R2)
          deletePromises.push(
            deleteFilesFromR2(`raw/movies/${baseFileName}.mp4`),
          );
          deletePromises.push(
            deleteFilesFromR2(`raw/episodes/${baseFileName}.mp4`),
          );
        }
      }
    });
  }

  // Chạy xóa file R2 ngầm (không dùng await để tránh bắt user phải chờ)
  Promise.all(deletePromises).catch((err) =>
    console.error("Lỗi Promise dọn rác R2:", err),
  );

  // 3. Xóa dữ liệu trong MySQL (Nhờ Cascade, episodes/actors/genres sẽ tự bay màu)
  return await prisma.$transaction(async (tx) => {
    // 3.1 Xóa các mảng vỏ của Season trước
    if (seasonShellIds.length > 0) {
      await tx.productions.deleteMany({
        where: { id: { in: seasonShellIds } },
      });
    }
    // 3.2 Xóa mảng vỏ gốc (vỏ Movie/vỏ Series)
    return await tx.productions.delete({ where: { id: Number(id) } });
  });
};

export const getMoviesService = async () => {
  return await prisma.productions.findMany({
    where: { type: { in: ["movie", "series"] } },
    orderBy: { created_at: "desc" },
  });
};

export const getMovieBySlugService = async (slug) => {
  const production = await prisma.productions.findUnique({
    where: { slug },
    include: {
      movies: true,
      series: {
        include: {
          seasons: {
            include: { productions: true },
            orderBy: { season_number: "asc" },
          },
        },
      },
      seasons: true,
      episodes: { orderBy: { episode_number: "asc" } },
      production_genres: { include: { genres: true } },
      production_actors: { include: { actors: true } },
    },
  });

  if (!production) throw new Error("Không tìm thấy phim!");

  let formattedSeasons = [];
  let formattedEpisodes = production.episodes || [];

  if (production.type === "series" && production.series) {
    formattedSeasons = production.series.seasons.map((s) => ({
      ...s,
      title: s.productions?.title || `Mùa ${s.season_number}`,
    }));

    if (formattedSeasons.length > 0) {
      const defaultSeasonId = formattedSeasons[0].id;
      formattedEpisodes = await prisma.episodes.findMany({
        where: { production_id: defaultSeasonId },
        orderBy: { episode_number: "asc" },
      });
    }
  }

  const genreIds = production.production_genres.map((pg) => pg.genre_id);
  let formattedRelated = [];

  if (genreIds.length > 0) {
    const relatedDb = await prisma.productions.findMany({
      where: {
        id: { not: production.id },
        type: { in: ["movie", "series"] },
        production_genres: {
          some: {
            genre_id: { in: genreIds },
          },
        },
      },
      take: 10,
      orderBy: { rating_avg: "desc" },
      include: {
        episodes: { select: { id: true } },
        movies: true,
        series: true,
      },
    });

    formattedRelated = relatedDb.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      poster: p.poster_url,
      poster_url: p.poster_url,
      type: p.type,
      eps: p.type === "movie" ? 1 : p.episodes.length,
      movies: p.movies,
      series: p.series,
    }));
  }

  return {
    ...production,
    seasons:
      formattedSeasons.length > 0 ? formattedSeasons : production.seasons,
    episodes: formattedEpisodes,
    genres: production.production_genres.map((pg) => pg.genres),
    actors: production.production_actors.map((pa) => ({
      ...pa.actors,
      character_name: pa.character_name,
      role_type: pa.role_type,
    })),
    related: formattedRelated,
  };
};

export const getGenresService = async () => {
  return await prisma.genres.findMany({ orderBy: { name: "asc" } });
};

export const getPopularMoviesService = async () => {
  const popularDb = await prisma.productions.findMany({
    where: {
      type: { in: ["movie", "series"] },
      status: "completed", // Tuỳ chọn: Chỉ lấy các phim đã hoàn thành, hoặc bạn có thể bỏ dòng này
    },
    take: 10, // Lấy top 10
    orderBy: [
      { rating_avg: "desc" }, // Ưu tiên điểm cao
      { rating_count: "desc" }, // Nếu bằng điểm thì ưu tiên lượt vote nhiều hơn
    ],
    include: {
      episodes: { select: { id: true } },
      movies: true,
      series: true,
    },
  });

  // Map data về đúng chuẩn Component của React
  return popularDb.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    poster: p.poster_url,
    poster_url: p.poster_url,
    type: p.type,
    eps: p.type === "movie" ? 1 : p.episodes.length,
    movies: p.movies,
    series: p.series,
  }));
};
