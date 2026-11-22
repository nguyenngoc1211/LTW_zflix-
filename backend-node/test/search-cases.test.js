import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "mysql://root:rootpassword@localhost:3306/movie_streaming_db";

const {
  buildElasticQuery,
  runWithFallback,
  searchProductions,
} = await import("../src/modules/discovery/search.service.js");

const baseFilters = {
  search: "",
  genre: "",
  country: "",
  year: "",
  minRating: "",
  sortYear: "desc",
};

test("ES-01: searches an exact movie title through Elasticsearch", () => {
  const query = buildElasticQuery({ ...baseFilters, search: "Interstellar" }, 0, 12);
  assert.equal(query.query.bool.must[0].multi_match.query, "Interstellar");
  assert.deepEqual(query.query.bool.must[0].multi_match.fields, ["title^3", "description", "genres"]);
});

test("ES-02: preserves mixed case for the case-insensitive Elasticsearch analyzer", () => {
  const query = buildElasticQuery({ ...baseFilters, search: "iNtErStElLaR" }, 0, 12);
  assert.equal(query.query.bool.must[0].multi_match.query, "iNtErStElLaR");
  assert.equal(query.query.bool.must[0].multi_match.operator, "and");
});

test("ES-03: enables fuzzy matching for a one-character title typo", () => {
  const query = buildElasticQuery({ ...baseFilters, search: "crush" }, 0, 12);
  assert.equal(query.query.bool.must[0].multi_match.query, "crush");
  assert.equal(query.query.bool.must[0].multi_match.fuzziness, "AUTO");
});

test("ES-04: falls back to the database when Elasticsearch is unavailable", async () => {
  const result = await runWithFallback(
    async () => { throw new Error("Elasticsearch unavailable"); },
    async () => ({ total: 1, items: [{ id: 25, title: "Crash Landing On You" }] }),
  );
  assert.deepEqual(result, { total: 1, items: [{ id: 25, title: "Crash Landing On You" }] });
});

test("ES-04: sends search requests to Elasticsearch before using MongoDB", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalDataStore = process.env.DATA_STORE;
  const calls = [];
  process.env.DATA_STORE = "mongodb";
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({
      hits: { total: { value: 1 }, hits: [{ _source: { id: 10, title: "Interstellar" } }] },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalDataStore === undefined) delete process.env.DATA_STORE;
    else process.env.DATA_STORE = originalDataStore;
  });

  const result = await searchProductions({ ...baseFilters, search: "Interstellar" }, 0, 12);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/productions\/_search$/);
  assert.equal(result.items[0].title, "Interstellar");
});

test("ES-05: filters only by genre", () => {
  const query = buildElasticQuery({ ...baseFilters, genre: "B\u00ed \u1ea9n" }, 0, 12);
  assert.deepEqual(query.query.bool.filter, [
    { terms: { type: ["movie", "series"] } },
    { term: { "genres.keyword": "B\u00ed \u1ea9n" } },
  ]);
});

test("ES-06: filters only by country", () => {
  const query = buildElasticQuery({ ...baseFilters, country: "UK" }, 0, 12);
  assert.deepEqual(query.query.bool.filter, [
    { terms: { type: ["movie", "series"] } },
    { term: { "country.keyword": "UK" } },
  ]);
});

test("ES-07: filters only by release year", () => {
  const query = buildElasticQuery({ ...baseFilters, year: "1999" }, 0, 12);
  assert.deepEqual(query.query.bool.filter, [
    { terms: { type: ["movie", "series"] } },
    { term: { release_year: 1999 } },
  ]);
});

test("ES-08: filters only by minimum rating", () => {
  const query = buildElasticQuery({ ...baseFilters, minRating: "4" }, 0, 12);
  assert.deepEqual(query.query.bool.filter, [
    { terms: { type: ["movie", "series"] } },
    { range: { rating_avg: { gte: 4 } } },
  ]);
});

test("ES-09: returns the full catalog when no filter is enabled", () => {
  const query = buildElasticQuery(baseFilters, 0, 12);
  assert.deepEqual(query.query.bool.must, [{ match_all: {} }]);
  assert.deepEqual(query.query.bool.filter, [{ terms: { type: ["movie", "series"] } }]);
});

test("ES-10: sorts by newest release year without adding a filter", () => {
  const query = buildElasticQuery({ ...baseFilters, sortYear: "desc" }, 0, 12);
  assert.deepEqual(query.sort, [{ release_year: "desc" }, { _score: "desc" }]);
  assert.deepEqual(query.query.bool.filter, [{ terms: { type: ["movie", "series"] } }]);
});
