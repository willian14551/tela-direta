import { AccessToken } from "livekit-server-sdk";

const TOKEN_TTL_S = 4 * 60 * 60; // credencial de acesso expira em 4h

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Veja o .env.example.`
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
  participantName: string
): Promise<{ token: string; livekitUrl: string }> {
  const apiKey = getEnv("LIVEKIT_API_KEY");
  const apiSecret = getEnv("LIVEKIT_API_SECRET");
  const livekitUrl = getEnv("LIVEKIT_URL");

  const identity = `${participantName.slice(0, 40)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

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

  // Observação: por padrão o LiveKit Cloud já fecha salas vazias após um
  // tempo. Para customizar esse prazo (empty_timeout) ou limite de
  // participantes por sala, configure pelo dashboard do LiveKit Cloud ou
  // crie a sala explicitamente antes via RoomServiceClient.

  const token = await at.toJwt();
  return { token, livekitUrl };
}
