import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAhoCorasick,
  detectToxicContent,
  findToxicTerms,
  getToxicAutomaton,
  normalizeForToxicFilter,
} from "../src/modules/community/toxic-comment.filter.js";

test("toxic filter loads both Vietnamese and English wordlists", () => {
  const automaton = getToxicAutomaton();
  assert.ok(automaton.size > 100);
});

test("toxic filter preserves Vietnamese diacritics while normalizing case and leetspeak", () => {
  assert.equal(normalizeForToxicFilter("ĐỊT"), "địt");
  assert.equal(normalizeForToxicFilter("ngu vãi"), "ngu vãi");
  assert.equal(normalizeForToxicFilter("@$$"), "ass");
});

test("toxic filter detects Vietnamese and English terms next to emoji", () => {
  assert.equal(detectToxicContent("Phim này địt😡 thật").isToxic, true);
  assert.equal(detectToxicContent("What the FUCK🤬").isToxic, true);
  assert.equal(detectToxicContent("đm🔥🔥").isToxic, true);
});

test("toxic filter covers combined rating title and review content", () => {
  assert.equal(detectToxicContent("Tiêu đề đánh giá\nNội dung shit🤮").isToxic, true);
  assert.equal(detectToxicContent("Hay nhưng nhiều cảnh buồn").isToxic, false);
});

test("word boundary matching ignores a toxic term inside a normal word", () => {
  const automaton = buildAhoCorasick(["ass"]);
  assert.deepEqual(findToxicTerms(automaton, "classic"), []);
  assert.deepEqual(findToxicTerms(automaton, "asshole"), []);
  assert.deepEqual(findToxicTerms(automaton, "that is ass!"), ["ass"]);
});

test("safe Vietnamese comments with emoji are not flagged", () => {
  assert.equal(detectToxicContent("Phim hay quá 😍 mình rất thích").isToxic, false);
  assert.equal(detectToxicContent("Bộ phim có quy mô lớn và dành cho các bạn nhỏ").isToxic, false);
  assert.equal(detectToxicContent("Các cảnh quay lớn tạo cảm giác choáng ngợp").isToxic, false);
  assert.equal(detectToxicContent("cac lon").isToxic, false);
  assert.equal(detectToxicContent("Nội dung như lồn").isToxic, true);
  assert.equal(detectToxicContent("Cặc, phim gì kỳ vậy").isToxic, true);
});
