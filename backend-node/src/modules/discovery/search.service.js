import { pool } from "../../core/database/pool.js";

const ES_URL = (process.env.ELASTICSEARCH_URL || "http://elasticsearch:9200").replace(/\/$/, "");
const INDEX = process.env.ELASTICSEARCH_INDEX || "productions";

const requestElastic = async (path, options = {}) => {
  const response = await fetch(`${ES_URL}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Elasticsearch ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};

export const buildElasticQuery = ({ search, genre, country, year, minRating, sortYear }, from, size) => {
  const must = search
    ? [{ multi_match: { query: search, fields: ["title^3", "description", "genres"], fuzziness: "AUTO", operator: "and" } }]
    : [{ match_all: {} }];
  const filter = [];
  if (genre) filter.push({ term: { "genres.keyword": genre } });
  if (country) filter.push({ term: { "country.keyword": country } });
  if (year) filter.push({ term: { release_year: Number(year) } });
  if (minRating) filter.push({ range: { rating_avg: { gte: Number(minRating) } } });
  return {
    from,
    size,
    query: { bool: { must, filter } },
    sort: [{ release_year: sortYear === "asc" ? "asc" : "desc" }, { _score: "desc" }],
  };
};

const productionRows = async () => {
  const [rows] = await pool.execute(`
    SELECT p.id, p.type, p.title, p.slug, p.description, p.poster_url, p.banner_url,
      p.status, p.release_year, p.is_premium, p.country, p.rating_avg, p.rating_count,
      p.language, GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR '||') AS genres
    FROM productions p
    LEFT JOIN production_genres pg ON pg.production_id = p.id
    LEFT JOIN genres g ON g.id = pg.genre_id
    GROUP BY p.id
  `);
  return rows.map((row) => ({
    ...row,
    release_year: row.release_year ? Number(row.release_year) : null,
    rating_avg: Number(row.rating_avg || 0),
    is_premium: Boolean(row.is_premium),
    genres: row.genres ? row.genres.split("||") : [],
  }));
};

export const syncProductionIndex = async () => {
  try {
    const exists = await fetch(`${ES_URL}/${INDEX}`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (exists.status === 404) {
      await requestElastic(`/${INDEX}`, {
        method: "PUT",
        body: JSON.stringify({
          mappings: {
            properties: {
              title: { type: "text", fields: { keyword: { type: "keyword" } } },
              description: { type: "text" },
              genres: { type: "text", fields: { keyword: { type: "keyword" } } },
              country: { type: "text", fields: { keyword: { type: "keyword" } } },
              release_year: { type: "integer" },
              rating_avg: { type: "float" },
            },
          },
        }),
      });
    }
    const rows = await productionRows();
    if (rows.length) {
      const body = rows.flatMap((row) => [JSON.stringify({ index: { _index: INDEX, _id: row.id } }), JSON.stringify(row)]).join("\n") + "\n";
      await requestElastic("/_bulk?refresh=true", { method: "POST", headers: { "content-type": "application/x-ndjson" }, body });
    }
    return rows.length;
  } catch (error) {
    console.warn("Production index sync skipped:", error.message);
    return 0;
  }
};

const mysqlFallback = async (filters, offset, limit) => {
  const clauses = [];
  const params = [];
  if (filters.search) {
    clauses.push("(LOWER(p.title) LIKE LOWER(?) OR LOWER(p.description) LIKE LOWER(?))");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.genre) { clauses.push("EXISTS (SELECT 1 FROM production_genres xpg JOIN genres xg ON xg.id=xpg.genre_id WHERE xpg.production_id=p.id AND xg.name=?)"); params.push(filters.genre); }
  if (filters.country) { clauses.push("p.country = ?"); params.push(filters.country); }
  if (filters.year) { clauses.push("p.release_year = ?"); params.push(Number(filters.year)); }
  if (filters.minRating) { clauses.push("p.rating_avg >= ?"); params.push(Number(filters.minRating)); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const base = `FROM productions p LEFT JOIN production_genres pg ON pg.production_id=p.id LEFT JOIN genres g ON g.id=pg.genre_id ${where}`;
  const [countRows] = await pool.execute(`SELECT COUNT(DISTINCT p.id) AS total ${base}`, params);
  const [rows] = await pool.execute(`SELECT p.*, GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR '||') AS genres ${base} GROUP BY p.id ORDER BY p.release_year ${filters.sortYear === "asc" ? "ASC" : "DESC"} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total: Number(countRows[0].total), items: rows.map((row) => ({ ...row, genres: row.genres ? row.genres.split("||") : [] })) };
};

export const searchProductions = async (filters, offset, limit) => {
  try {
    const result = await requestElastic(`/${INDEX}/_search`, { method: "POST", body: JSON.stringify(buildElasticQuery(filters, offset, limit)) });
    return { total: typeof result.hits.total === "number" ? result.hits.total : result.hits.total.value, items: result.hits.hits.map((hit) => hit._source) };
  } catch (error) {
    console.warn("Elasticsearch unavailable; using MySQL fallback:", error.message);
    return mysqlFallback(filters, offset, limit);
  }
};
