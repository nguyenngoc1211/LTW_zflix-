import test from "node:test";
import assert from "node:assert/strict";

// Test luôn chạy môi trường test, bất kể .env.local đặt NODE_ENV ra sao
process.env.NODE_ENV = "test";

process.env.DATABASE_URL ||= "mysql://root:rootpassword@localhost:3306/movie_streaming_db";

const { buildElasticQuery, rankTitleSuggestions } = await import("../src/modules/discovery/search.service.js");
const { clampPagination, parsePositiveInt } = await import("../src/core/utils/http.js");

test("search uses Elasticsearch full-text matching (case-insensitive analyzer)", () => {
  const query = buildElasticQuery({ search: "DaRk KnIgHt", sortYear: "desc" }, 0, 12);
  assert.equal(query.query.bool.must[0].multi_match.query, "DaRk KnIgHt");
  assert.deepEqual(query.query.bool.must[0].multi_match.fields, ["title^3", "description", "genres"]);
  assert.equal(query.query.bool.must[0].multi_match.fuzziness, "AUTO");
  assert.equal(query.query.bool.must[0].multi_match.operator, "and");
});

test("multiple movie filters are combined in one bool query", () => {
  const query = buildElasticQuery({ genre: "Hành động", country: "USA", year: "2019", minRating: "4", sortYear: "asc" }, 12, 6);
  assert.deepEqual(query.query.bool.filter, [
    { terms: { type: ["movie", "series"] } },
    { term: { "genres.keyword": "Hành động" } },
    { term: { "country.keyword": "USA" } },
    { term: { release_year: 2019 } },
    { range: { rating_avg: { gte: 4 } } },
  ]);
  assert.equal(query.sort[0].release_year, "asc");
  assert.equal(query.from, 12);
  assert.equal(query.size, 6);
});

test("pagination is bounded and stable", () => {
  assert.deepEqual(clampPagination({ page: "3", limit: "20" }), { page: 3, limit: 20, offset: 40 });
  assert.deepEqual(clampPagination({ page: "-2", limit: "999" }), { page: 1, limit: 50, offset: 0 });
});

test("resource ids reject invalid values", () => {
  assert.equal(parsePositiveInt("7"), 7);
  assert.throws(() => parsePositiveInt("0"), /positive integer/);
  assert.throws(() => parsePositiveInt("other-user"), /positive integer/);
});

test("title suggestions match substrings and prioritize the start of a word", () => {
  const rows = [
    { id: 1, title: "Finding Nemo", rating_avg: 4.5 },
    { id: 2, title: "Back to the Future", rating_avg: 4.2 },
    { id: 3, title: "Life of Pi", rating_avg: 4.9 },
  ];
  assert.deepEqual(rankTitleSuggestions(rows, "future").map((item) => item.id), [2]);
  assert.equal(rankTitleSuggestions(rows, "f")[0].id, 1);
  assert.ok(rankTitleSuggestions(rows, "f").some((item) => item.id === 2));
});
