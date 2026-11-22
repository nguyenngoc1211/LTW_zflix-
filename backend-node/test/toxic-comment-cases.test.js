import test from "node:test";
import assert from "node:assert/strict";

import {
  detectToxicContent,
  normalizeForToxicFilter,
} from "../src/modules/community/toxic-comment.filter.js";

test("CM-01: detects the Vietnamese violation term c\u1eb7c", () => {
  const result = detectToxicContent("Phim n\u00e0y c\u00f3 c\u1eb7c");
  assert.equal(result.isToxic, true);
  assert.ok(result.matches.includes("c\u1eb7c"));
});

test("CM-02: detects the English violation term fuck", () => {
  const result = detectToxicContent("This movie is fuck");
  assert.equal(result.isToxic, true);
  assert.ok(result.matches.includes("fuck"));
});

test("CM-03: normalizes replacement characters in @ss", () => {
  assert.equal(normalizeForToxicFilter("@ss"), "ass");
  assert.equal(detectToxicContent("What an @ss").isToxic, true);
});

test("CM-04: does not flag the valid phrase l\u1ed3ng ng\u1ef1c", () => {
  assert.equal(detectToxicContent("C\u1ea3nh phim c\u00f3 l\u1ed3ng ng\u1ef1c r\u1ea5t \u0111\u1eb9p").isToxic, false);
});

test("CM-05: flagged content is still classified instead of rejected by the detector", () => {
  const result = detectToxicContent("B\u00ecnh lu\u1eadn n\u00e0y c\u00f3 c\u1eb7c");
  assert.equal(result.isToxic, true);
  assert.ok(result.matches.length > 0);
});

test("CM-07: editing a safe comment to a violation rebuilds the toxic status", () => {
  const before = detectToxicContent("T\u00f4i th\u00edch ph\u1ea7n l\u1ed3ng ti\u1ebfng");
  const after = detectToxicContent("T\u00f4i th\u00edch ph\u1ea7n l\u1ed3n");
  assert.equal(before.isToxic, false);
  assert.equal(after.isToxic, true);
});
