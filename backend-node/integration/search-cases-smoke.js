import assert from "node:assert/strict";

const API_URL = (process.env.API_URL || "http://localhost:3000").replace(/\/$/, "");

const search = async (params = {}) => {
  const query = new URLSearchParams({ limit: "50", ...params });
  const response = await fetch(`${API_URL}/api/v1/productions?${query}`, {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, `Search returned HTTP ${response.status}`);
  return response.json();
};

const titles = (result) => result.items.map((item) => item.title);

const exact = await search({ search: "Interstellar" });
assert.equal(exact.total, 1);
assert.deepEqual(titles(exact), ["Interstellar"]);
console.log("ES-01 pass: exact title");

const mixedCase = await search({ search: "iNtErStElLaR" });
assert.equal(mixedCase.total, 1);
assert.deepEqual(titles(mixedCase), ["Interstellar"]);
console.log("ES-02 pass: case-insensitive title");

const typo = await search({ search: "crush" });
assert.ok(titles(typo).includes("Crash Landing On You"));
console.log("ES-03 pass: one-character typo");

const genre = "\u0042\u00ed \u1ea9n";
const genreResult = await search({ genre });
assert.ok(genreResult.total > 0);
assert.ok(genreResult.items.every((item) => item.genres?.includes(genre)));
console.log("ES-05 pass: genre filter");

const countryResult = await search({ country: "UK" });
assert.ok(countryResult.total > 0);
assert.ok(countryResult.items.every((item) => item.country === "UK"));
console.log("ES-06 pass: country filter");

const yearResult = await search({ year: "1999" });
assert.ok(yearResult.total > 0);
assert.ok(yearResult.items.every((item) => Number(item.release_year) === 1999));
console.log("ES-07 pass: year filter");

const ratingResult = await search({ minRating: "4" });
assert.ok(ratingResult.total > 0);
assert.ok(ratingResult.items.every((item) => Number(item.rating_avg) >= 4));
console.log("ES-08 pass: minimum rating filter");

const catalog = await search();
assert.ok(catalog.total > 0);
console.log("ES-09 pass: no filter returns catalog");

const years = catalog.items.map((item) => Number(item.release_year || 0));
assert.deepEqual(years, [...years].sort((left, right) => right - left));
console.log("ES-10 pass: newest-year sorting");

console.log("Search integration cases passed.");
