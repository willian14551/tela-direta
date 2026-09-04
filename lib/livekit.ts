import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { randomUUID } from "crypto";

const TOKEN_TTL_S = 4 * 60 * 60; // credencial de acesso expira em 4h

export const LIVEKIT_PARTICIPANT_ATTRIBUTES = {
  discordId: "tela-direta.discord.id",
  discordName: "tela-direta.discord.name",
  discordAvatarUrl: "tela-direta.discord.avatar",
} as const;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Veja o .env.example.`,
    );
  }
  return value;
}

function getLiveKitHttpUrl(): string {
  const url = new URL(getEnv("LIVEKIT_URL"));

  if (url.protocol === "wss:") url.protocol = "https:";
  else if (url.protocol === "ws:") url.protocol = "http:";
  else if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LIVEKIT_URL precisa começar com wss:// ou https://.");
  }

  // A API administrativa usa HTTP, enquanto os participantes recebem a URL
  // WebSocket original. O RoomServiceClient espera somente a origem do projeto.
  return url.origin;
}

function safeDiscordAvatarUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** Cria um cliente administrativo somente para uso em rotas do servidor. */
export function createRoomServiceClient(): RoomServiceClient {
  return new RoomServiceClient(
    getLiveKitHttpUrl(),
    getEnv("LIVEKIT_API_KEY"),
    getEnv("LIVEKIT_API_SECRET"),
  );
}

/**
 * Gera um token de acesso de curta duração para um participante entrar
 * numa sala específica. Isso roda só no servidor: LIVEKIT_API_SECRET
 * nunca é exposto ao navegador.
 */
export async function mintParticipantToken(
  roomId: string,
  participantName: string,
  discordId: string,
  discordName?: string | null,
  discordAvatarUrl?: string | null,
): Promise<{ token: string; livekitUrl: string }> {
  const apiKey = getEnv("LIVEKIT_API_KEY");
  const apiSecret = getEnv("LIVEKIT_API_SECRET");
  const livekitUrl = getEnv("LIVEKIT_URL");

  // A identidade técnica usa o ID validado pelo Discord. O nome escolhido
  // continua sendo apenas o nome visível dentro da sala.
  const identity = `discord-${discordId}-${randomParticipantSuffix()}`;

  const attributes: Record<string, string> = {
    [LIVEKIT_PARTICIPANT_ATTRIBUTES.discordId]: discordId,
  };
  const verifiedDiscordName = discordName?.trim().slice(0, 100);
  const verifiedDiscordAvatarUrl = safeDiscordAvatarUrl(discordAvatarUrl);

  if (verifiedDiscordName) {
    attributes[LIVEKIT_PARTICIPANT_ATTRIBUTES.discordName] =
      verifiedDiscordName;
  }
  if (verifiedDiscordAvatarUrl) {
    attributes[LIVEKIT_PARTICIPANT_ATTRIBUTES.discordAvatarUrl] =
      verifiedDiscordAvatarUrl;
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: participantName,
    ttl: TOKEN_TTL_S,
    attributes,
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    roomCreate: true, // cria a sala no LiveKit no primeiro a entrar
    canPublish: true, // qualquer participante pode compartilhar tela/câmera
    canSubscribe: true,
    canPublishData: true,
    roomRecord: false,
  });

  // A sala só passa a existir quando o primeiro participante entra. Pelo
  // padrão do LiveKit, ela é encerrada 20 segundos após a saída do último
  // participante (departure_timeout), dando tempo para uma reconexão breve.
  // O convite pode recriar outra sala com o mesmo nome enquanto estiver
  // válido, mas nenhuma mídia ou sala ativa permanece entre esses usos.

  const token = await at.toJwt();
  return { token, livekitUrl };
}

function randomParticipantSuffix(): string {
  return randomUUID().slice(0, 8);
}
