import test from "node:test";
import assert from "node:assert/strict";

import { selectContinueWatching } from "../src/modules/streaming/continue-watching.js";

test("continue watching keeps only the newest unfinished episode of each production", () => {
  const items = [
    { production_id: 1, episode_id: 11, last_position: 120, is_completed: 0 },
    { production_id: 1, episode_id: 12, last_position: 40, is_completed: 0 },
    { production_id: 2, episode_id: 21, last_position: 300, is_completed: 1 },
    { production_id: 3, episode_id: 31, last_position: 0, is_completed: 0 },
    { production_id: 4, episode_id: 41, last_position: 60, is_completed: "0" },
  ];

  assert.deepEqual(selectContinueWatching(items), [items[0], items[4]]);
});
