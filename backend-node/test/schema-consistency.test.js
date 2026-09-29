import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const [freshSchema, migrationRunner, phase4Migration] = await Promise.all([
  readFile(new URL("database/init.sql", root), "utf8"),
  readFile(new URL("backend-node/scripts/migrate-auth.js", root), "utf8"),
  readFile(new URL("backend-node/migrations/20260929_phase_4a_mfa_totp.sql", root), "utf8"),
]);

test("fresh and existing database paths include the same Phase 4A structures", () => {
  const requiredStructures = [
    "mfa_enabled",
    "mfa_secret_ciphertext",
    "mfa_secret_iv",
    "mfa_secret_tag",
    "mfa_enabled_at",
    "mfa_last_used_step",
    "auth_mfa_challenges",
    "auth_mfa_recovery_codes",
  ];
  for (const structure of requiredStructures) {
    assert.ok(freshSchema.includes(structure), `fresh schema missing ${structure}`);
    assert.ok(migrationRunner.includes(structure), `migration runner missing ${structure}`);
    assert.ok(phase4Migration.includes(structure), `phase migration missing ${structure}`);
  }
  assert.match(freshSchema, /`absolute_expires_at` datetime NOT NULL/u);
  assert.match(migrationRunner, /absolute_expires_at datetime NOT NULL/u);
});
