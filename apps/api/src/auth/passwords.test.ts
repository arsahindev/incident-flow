import assert from "node:assert/strict";
import { test } from "node:test";

import { hash } from "@node-rs/argon2";

import { hashPassword, verifyPasswordHash } from "./passwords.js";

const password = "Correct-Horse-Battery-Staple-2026!";
const pepper = Buffer.alloc(32, 1);
const otherPepper = Buffer.alloc(32, 2);

test("peppered password hashes use unique automatic salts", async () => {
  const firstHash = await hashPassword(password, pepper);
  const secondHash = await hashPassword(password, pepper);

  assert.match(firstHash, /^argon2id-pepper-v1:\$argon2id\$/);
  assert.notEqual(firstHash, secondHash);
  assert.equal(
    (await verifyPasswordHash(firstHash, password, pepper)).matches,
    true,
  );
});

test("password verification requires the configured pepper", async () => {
  const passwordHash = await hashPassword(password, pepper);

  assert.equal(
    (await verifyPasswordHash(passwordHash, password, otherPepper)).matches,
    false,
  );
});

test("legacy unpeppered hashes are accepted once and marked for upgrade", async () => {
  const legacyHash = await hash(password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const result = await verifyPasswordHash(legacyHash, password, pepper);

  assert.deepEqual(result, { matches: true, needsRehash: true });
});

test("a failed legacy-password verification is never eligible for upgrade", async () => {
  const legacyHash = await hash(password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  assert.deepEqual(
    await verifyPasswordHash(legacyHash, "incorrect-password", pepper),
    { matches: false, needsRehash: false },
  );
});

test("unknown password hash versions fail closed", async () => {
  assert.deepEqual(
    await verifyPasswordHash("argon2id-pepper-v2:unknown", password, pepper),
    { matches: false, needsRehash: false },
  );
});
