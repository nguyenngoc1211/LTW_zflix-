import test from 'node:test';
import assert from 'node:assert/strict';
import { createEpisodeWatchUrl, parseWatchPosition } from '../../frontend/src/utils/streaming/watchUrl.js';
import { selectContinueWatching } from '../src/modules/streaming/continue-watching.js';

test('resume URLs use the canonical movie and season, not the episode id', () => {
  assert.equal(createEpisodeWatchUrl({ id: 62, watch_production_id: 54, episode_number: 1, season_number: null }, 20), '/movies/54?ep=1&pos=20');
  assert.equal(createEpisodeWatchUrl({ id: 45, watch_production_id: 21, episode_number: 2, season_number: 3 }, 0), '/movies/21?ss=3&ep=2&pos=0');
  assert.equal(createEpisodeWatchUrl({ episode_number: 1 }, 20), null);
});

test('position parsing rejects negative, nonfinite and malformed values', () => {
  for (const value of [null, '', '-1', 'NaN', 'Infinity', '2x', ' 2']) assert.equal(parseWatchPosition(value), null);
  assert.equal(parseWatchPosition('0'), 0);
  assert.equal(parseWatchPosition('20.5'), 20.5);
});

test('continue watching deduplicates seasons of one series', () => {
  const items = [{ production_id: 31, watch_production_id: 21, last_position: 10, is_completed: 0 }, { production_id: 32, watch_production_id: 21, last_position: 20, is_completed: 0 }];
  assert.equal(selectContinueWatching(items).length, 1);
});
