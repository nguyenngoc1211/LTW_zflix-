import test from "node:test";
import assert from "node:assert/strict";
import { selectNextHost } from "../src/modules/watch-party/watch-party.host-order.js";

test("watch party transfers host to the earliest remaining participant", () => {
  const nextHost = selectNextHost([
    { user_id: 9, joined_at: new Date("2026-11-09T10:03:00Z") },
    { user_id: 4, joined_at: new Date("2026-11-09T10:01:00Z") },
    { user_id: 7, joined_at: new Date("2026-11-09T10:02:00Z") },
  ]);

  assert.equal(nextHost.user_id, 4);
});

test("watch party never reselects the leaving host", () => {
  const nextHost = selectNextHost([
    { user_id: 1, joined_at: new Date("2026-11-09T10:00:00Z") },
    { user_id: 2, joined_at: new Date("2026-11-09T10:01:00Z") },
    { user_id: 3, joined_at: new Date("2026-11-09T10:02:00Z") },
  ], 1);

  assert.equal(nextHost.user_id, 2);
});

test("watch party keeps the same join order across repeated host departures", () => {
  const participants = [
    { user_id: 1, joined_at: new Date("2026-11-09T10:00:00Z") },
    { user_id: 2, joined_at: new Date("2026-11-09T10:01:00Z") },
    { user_id: 3, joined_at: new Date("2026-11-09T10:02:00Z") },
  ];

  const secondUser = selectNextHost(participants, 1);
  const thirdUser = selectNextHost(participants.filter((item) => item.user_id !== 1), 2);
  assert.equal(secondUser.user_id, 2);
  assert.equal(thirdUser.user_id, 3);
});

test("watch party host order is deterministic when join times match", () => {
  const joinedAt = new Date("2026-11-09T10:01:00Z");
  const nextHost = selectNextHost([
    { user_id: 8, joined_at: joinedAt },
    { user_id: 5, joined_at: joinedAt },
  ]);

  assert.equal(nextHost.user_id, 5);
  assert.equal(selectNextHost([]), null);
});
