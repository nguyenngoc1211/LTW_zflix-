import { fromMongo, mongoCollection } from "../../../core/database/mongo.js";
import { nextNumericId, withMongoTransaction } from "../../../core/database/mongo.js";
import { applyEpisodeAccess, isPremiumLocked } from "../playback-access.js";
import { deleteFilesFromR2, uploadFileToR2 } from "../../../core/storage/upload.helper.js";
import { videoServiceProcessEndpoint } from "../../../config/video-service.config.js";
import axios from "axios";

const collectionRows = async (name, filter = {}, options = {}) =>
  (await mongoCollection(name)).find(filter, options).toArray();

const publicProduction = (row) => fromMongo(row);
const cleanSlug = (title) => title.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]+/gu, "-")
  .replace(/(^-|-$)+/gu, "");
const metadataList = (value) => value
  ? typeof value === "string" ? JSON.parse(value) : value : [];

const replaceGenres = async (productionId, genres, session) => {
  const links = await mongoCollection("production_genres");
  await links.deleteMany({ production_id: productionId }, { session });
  for (const genreId of [...new Set(metadataList(genres).map(Number))]) {
    await links.insertOne({ _id: { production_id: productionId, genre_id: genreId },
      production_id: productionId, genre_id: genreId }, { session });
  }
};

const replaceActors = async (productionId, actors, session) => {
  const links = await mongoCollection("production_actors");
  const actorCollection = await mongoCollection("actors");
  await links.deleteMany({ production_id: productionId }, { session });
  for (const [index, actor] of metadataList(actors).entries()) {
    let stored = await actorCollection.findOne({ name: actor.name }, { session });
    if (!stored) {
      const id = await nextNumericId("actors");
      stored = { _id: id, id, name: actor.name,
        slug: `${cleanSlug(actor.name)}-${Date.now()}`, avatar_url: actor.avatar_url || null };
      await actorCollection.insertOne(stored, { session });
    } else if (actor.avatar_url && actor.avatar_url !== stored.avatar_url) {
      await actorCollection.updateOne({ id: stored.id },
        { $set: { avatar_url: actor.avatar_url } }, { session });
    }
    await links.insertOne({ _id: { production_id: productionId, actor_id: stored.id },
      production_id: productionId, actor_id: stored.id,
      character_name: actor.character || null, display_order: index,
      role_type: actor.role_type || null }, { session });
  }
};

export const uploadMovieMongo = async (file, metadata) => {
  const fileName = file ? await uploadFileToR2(file, "raw/movies") : null;
  const id = await nextNumericId("productions");
  const type = metadata.type || "movie";
  const production = { _id: id, id, title: metadata.title,
    slug: cleanSlug(metadata.title), description: metadata.description || null,
    type, release_year: metadata.release_year ? Number(metadata.release_year) : null,
    is_premium: Number(metadata.is_premium === "true" || metadata.is_premium === true),
    status: metadata.status || "ongoing", poster_url: metadata.poster_url || null,
    banner_url: metadata.banner_url || null, country: metadata.country || null,
    language: metadata.language || null, rating_avg: 0, rating_count: 0,
    created_at: new Date(), updated_at: new Date() };
  let firstEpisodeId;
  await (await mongoCollection("productions")).createIndex({ slug: 1 }, { unique: true });
  await withMongoTransaction(async (session) => {
    await (await mongoCollection("productions")).insertOne(production, { session });
    if (metadata.genres) await replaceGenres(id, metadata.genres, session);
    if (metadata.actors) await replaceActors(id, metadata.actors, session);
    if (type === "movie") {
      const duration = Number.parseInt(metadata.duration, 10) || 0;
      await (await mongoCollection("movies")).insertOne({ _id: id, id, duration }, { session });
      firstEpisodeId = await nextNumericId("episodes");
      await (await mongoCollection("episodes")).insertOne({ _id: firstEpisodeId,
        id: firstEpisodeId, production_id: id, episode_number: 1,
        title: "Full Movie", video_url: fileName, duration,
        thumbnail_url: null, created_at: new Date() }, { session });
    } else if (type === "series") {
      await (await mongoCollection("series")).insertOne({ _id: id, id,
        total_seasons: 0 }, { session });
    }
  });
  if (firstEpisodeId && fileName) {
    axios.post(videoServiceProcessEndpoint, { file_name: fileName,
      production_id: id, episode_id: firstEpisodeId })
      .catch((error) => console.error("Lỗi gọi Python:", error.message));
  }
  return publicProduction(production);
};

export const updateProductionMongo = async (id, metadata) => {
  const productionId = Number(id);
  const updates = { updated_at: new Date() };
  for (const field of ["title", "description", "status", "poster_url", "banner_url",
    "country", "language"]) {
    if (metadata[field] !== undefined) updates[field] = metadata[field];
  }
  if (metadata.release_year !== undefined) updates.release_year = Number.parseInt(metadata.release_year, 10);
  if (metadata.is_premium !== undefined) updates.is_premium = Number(metadata.is_premium === "true"
    || metadata.is_premium === true);
  return withMongoTransaction(async (session) => {
    const productions = await mongoCollection("productions");
    const result = await productions.updateOne({ id: productionId }, { $set: updates }, { session });
    if (!result.matchedCount) throw new Error("Phim không tồn tại!");
    if (metadata.duration !== undefined) {
      const duration = Number.parseInt(metadata.duration, 10);
      await (await mongoCollection("movies")).updateOne({ id: productionId },
        { $set: { duration }, $setOnInsert: { _id: productionId, id: productionId } },
        { upsert: true, session });
      await (await mongoCollection("episodes")).updateMany({ production_id: productionId,
        episode_number: 1 }, { $set: { duration } }, { session });
    }
    if (metadata.genres) await replaceGenres(productionId, metadata.genres, session);
    if (metadata.actors) await replaceActors(productionId, metadata.actors, session);
    return publicProduction(await productions.findOne({ id: productionId }, { session }));
  });
};

export const deleteProductionMongo = async (id) => {
  const productionId = Number(id);
  const production = await (await mongoCollection("productions")).findOne({ id: productionId });
  if (!production) throw new Error("Phim không tồn tại!");
  const seasons = await collectionRows("seasons", { series_id: productionId });
  const productionIds = [productionId, ...seasons.map((season) => season.id)];
  const episodes = await collectionRows("episodes", { production_id: { $in: productionIds } });
  const episodeIds = episodes.map((episode) => episode.id);
  const comments = await collectionRows("comments", { production_id: { $in: productionIds } });
  const parties = await collectionRows("watch_parties", { $or: [
    { production_id: { $in: productionIds } }, { episode_id: { $in: episodeIds } },
  ] });
  const products = await collectionRows("production_products", { production_id: { $in: productionIds } });
  await withMongoTransaction(async (session) => {
    const remove = async (name, filter) =>
      (await mongoCollection(name)).deleteMany(filter, { session });
    const partyIds = parties.map((party) => party.id);
    await remove("watch_party_chats", { party_id: { $in: partyIds } });
    await remove("watch_party_participants", { party_id: { $in: partyIds } });
    await remove("watch_parties", { id: { $in: partyIds } });
    await remove("watch_history", { episode_id: { $in: episodeIds } });
    await remove("comment_likes", { comment_id: { $in: comments.map((comment) => comment.id) } });
    await remove("comments", { production_id: { $in: productionIds } });
    await remove("ratings", { production_id: { $in: productionIds } });
    await remove("bookmarks", { production_id: { $in: productionIds } });
    await remove("production_interests", { production_id: { $in: productionIds } });
    await remove("production_genres", { production_id: { $in: productionIds } });
    await remove("production_actors", { production_id: { $in: productionIds } });
    await remove("product_snapshots", { $or: [
      { episode_id: { $in: episodeIds } },
      { matched_product_id: { $in: products.map((product) => product.id) } },
    ] });
    await remove("production_products", { production_id: { $in: productionIds } });
    await remove("episodes", { id: { $in: episodeIds } });
    await remove("movies", { id: { $in: productionIds } });
    await remove("seasons", { id: { $in: productionIds } });
    await remove("series", { id: { $in: productionIds } });
    await (await mongoCollection("daily_stats")).updateMany({ top_production_id: { $in: productionIds } },
      { $set: { top_production_id: null } }, { session });
    await remove("productions", { id: { $in: productionIds } });
  });
  const domain = process.env.R2_PUBLIC_DOMAIN || "";
  const cleanup = [];
  for (const episode of episodes) {
    const url = episode.video_url || "";
    let baseName = "";
    if (domain && url.includes(domain) && url.includes(".m3u8")) {
      const folder = url.replace(`${domain}/`, "").replace("playlist.m3u8", "");
      cleanup.push(deleteFilesFromR2(folder));
      baseName = folder.split("/").at(-2);
    } else if (url.startsWith("raw/")) {
      cleanup.push(deleteFilesFromR2(url));
      baseName = url.split("/").at(-1).split(".")[0];
    }
    if (baseName) {
      cleanup.push(deleteFilesFromR2(`hls/${baseName}/`));
      cleanup.push(deleteFilesFromR2(`raw/movies/${baseName}.mp4`));
      cleanup.push(deleteFilesFromR2(`raw/episodes/${baseName}.mp4`));
    }
  }
  Promise.all(cleanup).catch((error) => console.error("Lỗi Promise dọn rác R2:", error));
  return publicProduction(production);
};

export const getMoviesMongo = async () => {
  const rows = await collectionRows("productions", { type: { $in: ["movie", "series"] } });
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(publicProduction);
};

export const getGenresMongo = async () =>
  (await collectionRows("genres")).sort((a, b) => a.name.localeCompare(b.name))
    .map(fromMongo);

const relatedView = (production, episodes, movie, series) => ({
  id: production.id, slug: production.slug, title: production.title,
  poster: production.poster_url, poster_url: production.poster_url,
  type: production.type,
  eps: production.type === "movie" ? 1 : episodes.filter((episode) => episode.production_id === production.id).length,
  movies: movie ? fromMongo(movie) : null,
  series: series ? fromMongo(series) : null,
});

export const getPopularMoviesMongo = async () => {
  const [productions, episodes, movies, series] = await Promise.all([
    collectionRows("productions", { type: { $in: ["movie", "series"] }, status: "completed" }),
    collectionRows("episodes"), collectionRows("movies"), collectionRows("series"),
  ]);
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));
  const seriesById = new Map(series.map((item) => [item.id, item]));
  return productions.sort((a, b) => Number(b.rating_avg?.toString() || 0) - Number(a.rating_avg?.toString() || 0)
    || Number(b.rating_count || 0) - Number(a.rating_count || 0))
    .slice(0, 10).map((production) => relatedView(production, episodes,
      movieById.get(production.id), seriesById.get(production.id)));
};

export const getMovieBySlugMongo = async (slug, viewer = null) => {
  const production = await (await mongoCollection("productions")).findOne({ slug });
  if (!production) throw new Error("Không tìm thấy phim!");
  const [movies, seriesRows, seasonRows, allProductions, allEpisodes,
    genreLinks, genres, actorLinks, actors] = await Promise.all([
    collectionRows("movies", { id: production.id }),
    collectionRows("series", { id: production.id }),
    collectionRows("seasons"), collectionRows("productions"),
    collectionRows("episodes"), collectionRows("production_genres"),
    collectionRows("genres"), collectionRows("production_actors"),
    collectionRows("actors"),
  ]);
  const seasonList = seasonRows.filter((season) => season.series_id === production.id)
    .sort((a, b) => a.season_number - b.season_number);
  const productionById = new Map(allProductions.map((row) => [row.id, row]));
  const formattedSeasons = seasonList.map((season) => ({ ...fromMongo(season),
    productions: publicProduction(productionById.get(season.id)),
    title: productionById.get(season.id)?.title || `Mùa ${season.season_number}` }));
  const episodeProductionId = production.type === "series" && formattedSeasons.length
    ? formattedSeasons[0].id : production.id;
  const episodes = allEpisodes.filter((episode) => episode.production_id === episodeProductionId)
    .sort((a, b) => a.episode_number - b.episode_number);
  const ownGenreLinks = genreLinks.filter((link) => link.production_id === production.id);
  const genreById = new Map(genres.map((genre) => [genre.id, genre]));
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const relatedIds = new Set(genreLinks.filter((link) => ownGenreLinks.some((own) => own.genre_id === link.genre_id))
    .map((link) => link.production_id));
  const movieById = new Map((await collectionRows("movies")).map((row) => [row.id, row]));
  const seriesById = new Map((await collectionRows("series")).map((row) => [row.id, row]));
  const related = allProductions.filter((row) => row.id !== production.id
    && ["movie", "series"].includes(row.type) && relatedIds.has(row.id))
    .sort((a, b) => Number(b.rating_avg?.toString() || 0) - Number(a.rating_avg?.toString() || 0))
    .slice(0, 10).map((row) => relatedView(row, allEpisodes,
      movieById.get(row.id), seriesById.get(row.id)));
  return {
    ...publicProduction(production),
    movies: movies[0] ? fromMongo(movies[0]) : null,
    series: seriesRows[0] ? { ...fromMongo(seriesRows[0]), seasons: formattedSeasons } : null,
    seasons: formattedSeasons.length ? formattedSeasons
      : seasonRows.filter((row) => row.id === production.id).map(fromMongo),
    locked: isPremiumLocked(production.is_premium, viewer),
    episodes: episodes.map((episode) => applyEpisodeAccess(fromMongo(episode),
      { premium: Boolean(production.is_premium), user: viewer })),
    genres: ownGenreLinks.map((link) => genreById.get(link.genre_id)).filter(Boolean).map(fromMongo),
    actors: actorLinks.filter((link) => link.production_id === production.id)
      .flatMap((link) => {
        const actor = actorById.get(link.actor_id);
        return actor ? [{ ...fromMongo(actor), character_name: link.character_name,
          role_type: link.role_type }] : [];
      }),
    related,
    production_genres: ownGenreLinks.map(fromMongo),
    production_actors: actorLinks.filter((link) => link.production_id === production.id).map(fromMongo),
  };
};
