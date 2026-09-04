export type AdminMediaStatus = "active" | "muted" | "off";
export type AdminParticipantState =
  | "joining"
  | "joined"
  | "active"
  | "disconnected";

export type AdminParticipantSnapshot = {
  sid: string;
  chosenName: string;
  discordId: string | null;
  discordName: string | null;
  discordAvatarUrl: string | null;
  joinedAt: string;
  region: string | null;
  state: AdminParticipantState;
  media: {
    microphone: AdminMediaStatus;
    camera: AdminMediaStatus;
    screenShare: AdminMediaStatus;
    screenShareAudio: AdminMediaStatus;
  };
};

export type AdminRoomSnapshot = {
  sid: string;
  name: string;
  createdAt: string;
  participantCount: number;
  publisherCount: number;
  participantsUnavailable: boolean;
  participants: AdminParticipantSnapshot[];
};

export type AdminSessionsSnapshot = {
  fetchedAt: string;
  totalParticipants: number;
  rooms: AdminRoomSnapshot[];
};
