import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Guarda de salas.
 *
 * MVP: fica em memória do processo Node. Isso é suficiente para um único
 * servidor rodando, mas some se o processo reiniciar e não funciona com
 * múltiplas instâncias. Para produção real, troque este Map por Redis
 * (ex: Upstash) ou um banco de dados, mantendo a mesma interface.
 */

type RoomRecord = {
  roomId: string;
  secretHash: string; // sha256(secret), nunca guardamos o segredo em texto puro
  createdAt: number;
  expiresAt: number;
};

const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // sala "convite" válida por 24h

const rooms = new Map<string, RoomRecord>();

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function createRoom(): { roomId: string; secret: string } {
  // roomId: identificador curto e não sequencial (não precisa ser secreto).
  const roomId = randomBytes(6).toString("base64url");
  // secret: a "chave" real de acesso, vai só no fragmento do link (#s=...),
  // que o navegador nunca envia ao servidor automaticamente.
  const secret = randomBytes(24).toString("base64url");

  const now = Date.now();
  rooms.set(roomId, {
    roomId,
    secretHash: hashSecret(secret),
    createdAt: now,
    expiresAt: now + ROOM_TTL_MS,
  });

  return { roomId, secret };
}

export function verifyRoomSecret(roomId: string, secret: string): boolean {
  const record = rooms.get(roomId);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    rooms.delete(roomId);
    return false;
  }

  const given = Buffer.from(hashSecret(secret));
  const expected = Buffer.from(record.secretHash);
  if (given.length !== expected.length) return false;

  return timingSafeEqual(given, expected);
}

export function roomExists(roomId: string): boolean {
  const record = rooms.get(roomId);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    rooms.delete(roomId);
    return false;
  }
  return true;
}
