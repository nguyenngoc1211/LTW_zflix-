import test from "node:test";
import assert from "node:assert/strict";

import { resolveWatchProgress } from "../src/modules/streaming/watch-progress.js";

test("a saved position close to the media end is completed and displayed as 100 percent", () => {
  const progress = resolveWatchProgress({ position: 20, duration: 23 });
  assert.deepEqual(progress, { position: 23, watchedPercent: 100, completed: true });
});

test("a genuine playback-ended event completes even if the database duration is longer", () => {
  const progress = resolveWatchProgress({ position: 87, duration: 100, completed: true });
  assert.deepEqual(progress, { position: 100, watchedPercent: 100, completed: true });
});

test("positions before the completion threshold remain resumable", () => {
  const progress = resolveWatchProgress({ position: 10, duration: 23 });
  assert.equal(progress.completed, false);
  assert.equal(progress.position, 10);
  assert.ok(Math.abs(progress.watchedPercent - 43.47826086956522) < 0.000001);
});

test("a long movie at 95 percent is completed", () => {
  const progress = resolveWatchProgress({ position: 6900, duration: 7200 });
  assert.equal(progress.completed, true);
  assert.equal(progress.watchedPercent, 100);
});

test("a long movie at 88 percent remains unfinished", () => {
  const progress = resolveWatchProgress({ position: 6336, duration: 7200 });
  assert.equal(progress.completed, false);
  assert.equal(progress.watchedPercent, 88);
});

test("positions are clamped to the media duration", () => {
  const progress = resolveWatchProgress({ position: 200, duration: 100 });
  assert.deepEqual(progress, { position: 100, watchedPercent: 100, completed: true });
});
