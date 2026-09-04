import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Convites de sala sem estado persistente.
 *
 * A Vercel pode atender duas requisições em instâncias diferentes. Por isso,
 * guardar as salas num Map em memória faz um convite recém-criado aparecer
 * como inexistente. O segredo abaixo contém validade e nonce, assinados com
 * HMAC; qualquer instância consegue validá-lo sem banco e ninguém consegue
 * alterar seus dados sem conhecer a chave do servidor.
 */

const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // sala "convite" válida por 24h
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SECRET_VERSION = "v1";
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{8}$/;
const EXPIRATION_PATTERN = /^[0-9a-z]+$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function getSigningSecret(): string {
  const secret =
    process.env.ROOM_SIGNING_SECRET?.trim() || process.env.AUTH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      "Configure ROOM_SIGNING_SECRET ou AUTH_SECRET com pelo menos 32 caracteres.",
    );
  }

  return secret;
}

function signInvite(roomId: string, expiration: string, nonce: string): string {
  const payload = `${SECRET_VERSION}.${roomId}.${expiration}.${nonce}`;

  return createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
}

export function createRoom(): { roomId: string; secret: string } {
  // roomId: identificador curto e não sequencial (não precisa ser secreto).
  const roomId = randomBytes(6).toString("base64url");
  const expiration = (Date.now() + ROOM_TTL_MS).toString(36);
  const nonce = randomBytes(16).toString("base64url");
  const signature = signInvite(roomId, expiration, nonce);
  // O segredo vai no fragmento (#s=...), que o navegador não envia em GET.
  const secret = `${SECRET_VERSION}.${expiration}.${nonce}.${signature}`;

  return { roomId, secret };
}

export function verifyRoomSecret(roomId: string, secret: string): boolean {
  if (!ROOM_ID_PATTERN.test(roomId) || secret.length > 160) {
    return false;
  }

  const parts = secret.split(".");
  if (parts.length !== 4) return false;

  const [version, expiration, nonce, givenSignature] = parts;

  if (
    version !== SECRET_VERSION ||
    !EXPIRATION_PATTERN.test(expiration) ||
    !NONCE_PATTERN.test(nonce) ||
    !SIGNATURE_PATTERN.test(givenSignature)
  ) {
    return false;
  }

  const expiresAt = Number.parseInt(expiration, 36);
  const now = Date.now();

  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + ROOM_TTL_MS + MAX_CLOCK_SKEW_MS
  ) {
    return false;
  }

  const expectedSignature = signInvite(roomId, expiration, nonce);
  const given = Buffer.from(givenSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (given.length !== expected.length) return false;

  return timingSafeEqual(given, expected);
}
