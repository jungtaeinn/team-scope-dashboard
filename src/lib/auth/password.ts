import { hash as hashArgon2, verify as verifyArgon2 } from '@node-rs/argon2';
import { verifyPassword as verifyLegacyPassword } from 'better-auth/crypto';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password-policy';

const ARGON2_MEMORY_COST = 19 * 1024;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_OUTPUT_LENGTH = 32;
const ARGON2_ID = 2;

function normalizePassword(password: string) {
  return password.normalize('NFKC');
}

export function validatePasswordLength(password: string) {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

function isArgon2Hash(hash: string) {
  return hash.startsWith('$argon2');
}

export async function hashPassword(password: string) {
  return hashArgon2(normalizePassword(password), {
    algorithm: ARGON2_ID,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    outputLen: ARGON2_OUTPUT_LENGTH,
  });
}

export async function verifyPassword(input: { hash: string; password: string }) {
  const normalizedPassword = normalizePassword(input.password);

  if (isArgon2Hash(input.hash)) {
    return verifyArgon2(input.hash, normalizedPassword);
  }

  return verifyLegacyPassword({
    hash: input.hash,
    password: normalizedPassword,
  });
}
