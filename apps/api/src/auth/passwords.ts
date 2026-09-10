import { hash, verify } from "@node-rs/argon2";

const passwordOptions = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
const currentPasswordHashPrefix = "argon2id-pepper-v1:";

export async function hashPassword(password: string, pepper: Uint8Array) {
  const passwordHash = await hash(password, {
    ...passwordOptions,
    secret: pepper,
  });
  return `${currentPasswordHashPrefix}${passwordHash}`;
}

export async function verifyPasswordHash(
  storedHash: string,
  password: string,
  pepper: Uint8Array,
) {
  if (storedHash.startsWith(currentPasswordHashPrefix)) {
    return {
      matches: await verify(
        storedHash.slice(currentPasswordHashPrefix.length),
        password,
        { secret: pepper },
      ),
      needsRehash: false,
    };
  }

  // unknown versioned formats fail closed instead of bypassing the pepper.
  if (!storedHash.startsWith("$argon2")) {
    return { matches: false, needsRehash: false };
  }

  // Phase 2 hashes doesn't have peppering. A successful login upgrades them below;
  const matches = await verify(storedHash, password);
  return { matches, needsRehash: matches };
}
