import { AccessToken } from "livekit-server-sdk";
import { randomUUID } from "crypto";

const TOKEN_TTL_S = 4 * 60 * 60; // credencial de acesso expira em 4h

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Veja o .env.example.`,
    );
  }
  return value;
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
): Promise<{ token: string; livekitUrl: string }> {
  const apiKey = getEnv("LIVEKIT_API_KEY");
  const apiSecret = getEnv("LIVEKIT_API_SECRET");
  const livekitUrl = getEnv("LIVEKIT_URL");

  // A identidade técnica usa o ID validado pelo Discord. O nome escolhido
  // continua sendo apenas o nome visível dentro da sala.
  const identity = `discord-${discordId}-${randomParticipantSuffix()}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: participantName,
    ttl: TOKEN_TTL_S,
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
