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

test("toxic filter normalizes Vietnamese diacritics, case and leetspeak", () => {
  assert.equal(normalizeForToxicFilter("ĐỊT"), "dit");
  assert.equal(normalizeForToxicFilter("ngu vãi"), "ngu vai");
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
});
