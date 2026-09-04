import {
  ParticipantInfo_State,
  TrackSource,
  type ParticipantInfo,
  type Room,
  type TrackInfo,
} from "livekit-server-sdk";
import {
  createRoomServiceClient,
  LIVEKIT_PARTICIPANT_ATTRIBUTES,
} from "@/lib/livekit";
import type {
  AdminMediaStatus,
  AdminParticipantSnapshot,
  AdminParticipantState,
  AdminRoomSnapshot,
  AdminSessionsSnapshot,
} from "@/types/admin";

const PARTICIPANT_IDENTITY_PATTERN = /^discord-(\d{16,22})-/;

function toIsoTimestamp(milliseconds: bigint, seconds: bigint): string {
  const timestamp =
    milliseconds > BigInt(0)
      ? Number(milliseconds)
      : Number(seconds) * 1_000;
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function participantState(state: ParticipantInfo_State): AdminParticipantState {
  switch (state) {
    case ParticipantInfo_State.JOINING:
      return "joining";
    case ParticipantInfo_State.JOINED:
      return "joined";
    case ParticipantInfo_State.DISCONNECTED:
      return "disconnected";
    default:
      return "active";
  }
}

function mediaStatus(
  tracks: TrackInfo[],
  source: TrackSource,
): AdminMediaStatus {
  const track = tracks.find((candidate) => candidate.source === source);
  if (!track) return "off";
  return track.muted ? "muted" : "active";
}

function discordIdFromParticipant(participant: ParticipantInfo): string | null {
  const attributeId =
    participant.attributes[LIVEKIT_PARTICIPANT_ATTRIBUTES.discordId];
  if (/^\d{16,22}$/.test(attributeId ?? "")) return attributeId;

  // Participantes conectados com tokens anteriores ao painel ainda podem ser
  // identificados pelo formato técnico já usado pelo Tela Direta.
  return participant.identity.match(PARTICIPANT_IDENTITY_PATTERN)?.[1] ?? null;
}

function safeDiscordAvatarUrl(value: string | undefined): string | null {
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

function serializeParticipant(
  participant: ParticipantInfo,
): AdminParticipantSnapshot {
  const verifiedDiscordName =
    participant.attributes[LIVEKIT_PARTICIPANT_ATTRIBUTES.discordName]?.
      trim()
      .slice(0, 100) || null;

  return {
    sid: participant.sid,
    chosenName: participant.name.trim().slice(0, 60) || "Participante",
    discordId: discordIdFromParticipant(participant),
    discordName: verifiedDiscordName,
    discordAvatarUrl: safeDiscordAvatarUrl(
      participant.attributes[LIVEKIT_PARTICIPANT_ATTRIBUTES.discordAvatarUrl],
    ),
    joinedAt: toIsoTimestamp(participant.joinedAtMs, participant.joinedAt),
    region: participant.region.trim().slice(0, 40) || null,
    state: participantState(participant.state),
    media: {
      microphone: mediaStatus(participant.tracks, TrackSource.MICROPHONE),
      camera: mediaStatus(participant.tracks, TrackSource.CAMERA),
      screenShare: mediaStatus(participant.tracks, TrackSource.SCREEN_SHARE),
      screenShareAudio: mediaStatus(
        participant.tracks,
        TrackSource.SCREEN_SHARE_AUDIO,
      ),
    },
  };
}

function serializeRoom(
  room: Room,
  participants: ParticipantInfo[],
  participantsUnavailable: boolean,
): AdminRoomSnapshot {
  return {
    sid: room.sid,
    name: room.name,
    createdAt: toIsoTimestamp(room.creationTimeMs, room.creationTime),
    participantCount: room.numParticipants,
    publisherCount: room.numPublishers,
    participantsUnavailable,
    participants: participants
      .map(serializeParticipant)
      .sort((first, second) => first.joinedAt.localeCompare(second.joinedAt)),
  };
}

export async function getActiveSessions(): Promise<AdminSessionsSnapshot> {
  const roomService = createRoomServiceClient();
  const rooms = await roomService.listRooms();
  const roomSnapshots = await Promise.all(
    rooms.map(async (room) => {
      try {
        const participants = await roomService.listParticipants(room.name);
        return serializeRoom(room, participants, false);
      } catch (error) {
        // A sala pode fechar entre listRooms e listParticipants. Mantemos o
        // cartão visível nesta atualização e tentamos novamente no próximo ciclo.
        console.warn(
          `[admin] Não foi possível listar participantes da sala ${room.name}:`,
          error,
        );
        return serializeRoom(room, [], true);
      }
    }),
  );

  roomSnapshots.sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );

  return {
    fetchedAt: new Date().toISOString(),
    totalParticipants: roomSnapshots.reduce(
      (total, room) => total + room.participantCount,
      0,
    ),
    rooms: roomSnapshots,
  };
}
