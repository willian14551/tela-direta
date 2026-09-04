"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AdminMediaStatus,
  AdminParticipantSnapshot,
  AdminParticipantState,
  AdminRoomSnapshot,
  AdminSessionsSnapshot,
} from "@/types/admin";

const REFRESH_INTERVAL_MS = 5_000;

function formatDuration(isoDate: string, now: number | null): string {
  if (now === null) return "—";

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(isoDate).getTime()) / 1_000),
  );
  if (elapsedSeconds < 60) return `${elapsedSeconds}s`;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const remainingMinutes = elapsedMinutes % 60;
  return remainingMinutes > 0
    ? `${elapsedHours}h ${remainingMinutes}min`
    : `${elapsedHours}h`;
}

function formatClock(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(isoDate));
}

function mediaStatusLabel(status: AdminMediaStatus): string {
  if (status === "active") return "Ativo";
  if (status === "muted") return "Silenciado";
  return "Desligado";
}

function participantStateLabel(state: AdminParticipantState): string {
  if (state === "joining") return "Conectando";
  if (state === "joined") return "Entrando";
  if (state === "disconnected") return "Desconectando";
  return "Conectado";
}

function MediaBadge({
  label,
  status,
}: {
  label: string;
  status: AdminMediaStatus;
}) {
  return (
    <span
      className={`admin-media-badge is-${status}`}
      title={`${label}: ${mediaStatusLabel(status)}`}
    >
      <span className="admin-media-indicator" aria-hidden="true" />
      {label}
      <span className="sr-only">: {mediaStatusLabel(status)}</span>
    </span>
  );
}

function ParticipantRow({
  participant,
  now,
}: {
  participant: AdminParticipantSnapshot;
  now: number | null;
}) {
  const primaryName = participant.discordName || participant.chosenName;
  const roomNameDiffers =
    participant.discordName && participant.discordName !== participant.chosenName;
  const initial = primaryName.trim().charAt(0).toUpperCase() || "?";

  return (
    <li className="admin-participant">
      <div className="admin-participant-profile">
        <span
          className={`admin-participant-avatar${participant.discordAvatarUrl ? " has-image" : ""}`}
          style={
            participant.discordAvatarUrl
              ? { backgroundImage: `url("${participant.discordAvatarUrl}")` }
              : undefined
          }
          aria-hidden="true"
        >
          {!participant.discordAvatarUrl && initial}
        </span>
        <div className="admin-participant-identity">
          <div className="admin-participant-name-row">
            <strong>{primaryName}</strong>
            {participant.discordId && (
              <span
                className="admin-verified-badge"
                title="Identidade recebida do login com Discord"
              >
                Verificado
              </span>
            )}
          </div>
          <span>
            {roomNameDiffers
              ? `Na sala como ${participant.chosenName}`
              : participant.discordName
                ? "Mesmo nome usado na sala"
                : "Conectado com token anterior"}
          </span>
          {participant.discordId && (
            <code title="ID da conta Discord">{participant.discordId}</code>
          )}
        </div>
      </div>

      <div className="admin-participant-session">
        <span>
          Na sala há <strong>{formatDuration(participant.joinedAt, now)}</strong>
        </span>
        <span className={`admin-connection-state is-${participant.state}`}>
          {participantStateLabel(participant.state)}
          {participant.region ? ` · Região ${participant.region}` : ""}
        </span>
      </div>

      <div className="admin-participant-media" aria-label="Mídias publicadas">
        <MediaBadge label="Voz" status={participant.media.microphone} />
        <MediaBadge label="Câmera" status={participant.media.camera} />
        <MediaBadge label="Tela" status={participant.media.screenShare} />
        <MediaBadge
          label="Som da tela"
          status={participant.media.screenShareAudio}
        />
      </div>
    </li>
  );
}

function RoomCard({ room, now }: { room: AdminRoomSnapshot; now: number | null }) {
  return (
    <article className="admin-room-card">
      <header className="admin-room-header">
        <div>
          <div className="admin-room-title-row">
            <span className="admin-live-dot" aria-hidden="true" />
            <h2>Sala {room.name}</h2>
          </div>
          <p>
            Aberta há {formatDuration(room.createdAt, now)} · criada às{" "}
            {formatClock(room.createdAt)}
          </p>
        </div>
        <div className="admin-room-counts">
          <strong>{room.participantCount}</strong>
          <span>{room.participantCount === 1 ? "pessoa" : "pessoas"}</span>
        </div>
      </header>

      {room.participantsUnavailable ? (
        <p className="admin-inline-warning" role="status">
          Os participantes desta sala não puderam ser consultados nesta
          atualização.
        </p>
      ) : room.participants.length === 0 ? (
        <p className="admin-room-empty">
          A sala está encerrando e já não possui participantes.
        </p>
      ) : (
        <ul className="admin-participant-list">
          {room.participants.map((participant) => (
            <ParticipantRow
              key={participant.sid}
              participant={participant}
              now={now}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

export function AdminDashboard({ adminName }: { adminName: string }) {
  const [snapshot, setSnapshot] = useState<AdminSessionsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let nextRefresh: ReturnType<typeof setTimeout> | null = null;
    let currentRequest: AbortController | null = null;

    async function refresh() {
      currentRequest = new AbortController();
      setIsRefreshing(true);

      try {
        const response = await fetch("/api/admin/sessions", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: currentRequest.signal,
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Não foi possível atualizar as sessões.";
          throw new Error(message);
        }

        if (
          typeof payload !== "object" ||
          payload === null ||
          !("rooms" in payload) ||
          !Array.isArray(payload.rooms)
        ) {
          throw new Error("O servidor devolveu uma resposta inesperada.");
        }

        if (!disposed) {
          setSnapshot(payload as AdminSessionsSnapshot);
          setError(null);
        }
      } catch (caughtError) {
        if (
          !disposed &&
          !(caughtError instanceof DOMException && caughtError.name === "AbortError")
        ) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível atualizar as sessões.",
          );
        }
      } finally {
        if (!disposed) {
          setIsRefreshing(false);
          nextRefresh = setTimeout(refresh, REFRESH_INTERVAL_MS);
        }
      }
    }

    void refresh();

    return () => {
      disposed = true;
      currentRequest?.abort();
      if (nextRefresh) clearTimeout(nextRefresh);
    };
  }, [refreshRequest]);

  const activeScreenShares = useMemo(
    () =>
      snapshot?.rooms.reduce(
        (total, room) =>
          total +
          room.participants.filter(
            (participant) => participant.media.screenShare === "active",
          ).length,
        0,
      ) ?? 0,
    [snapshot],
  );

  return (
    <div className="admin-page">
      <header className="admin-top-bar">
        <a className="brand admin-brand" href="/">
          <span className="brand-dot" aria-hidden="true" />
          Tela Direta
          <span className="admin-brand-badge">Admin</span>
        </a>
        <div className="admin-header-actions">
          <span className="admin-user-name" title={adminName}>
            {adminName}
          </span>
          <a className="btn btn-secondary admin-back-button" href="/">
            Voltar ao início
          </a>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-heading">
          <div>
            <span className="admin-eyebrow">Monitoramento em tempo real</span>
            <h1>Sessões ativas</h1>
            <p>
              Salas e participantes conectados agora. A lista é atualizada a
              cada 5 segundos.
            </p>
          </div>
          <div className="admin-refresh-area">
            <button
              type="button"
              className="btn btn-secondary admin-refresh-button"
              onClick={() => setRefreshRequest((request) => request + 1)}
              disabled={isRefreshing}
              aria-label="Atualizar sessões agora"
            >
              <span
                className={`admin-refresh-icon${isRefreshing ? " is-spinning" : ""}`}
                aria-hidden="true"
              >
                ↻
              </span>
              Atualizar
            </button>
            {snapshot && (
              <span className="admin-updated-at">
                Atualizado às {formatClock(snapshot.fetchedAt)}
              </span>
            )}
          </div>
        </section>

        {error && (
          <div className="admin-error-banner" role="alert">
            <strong>Falha na atualização</strong>
            <span>{error} Tentaremos novamente automaticamente.</span>
          </div>
        )}

        <section className="admin-summary" aria-label="Resumo das sessões">
          <article>
            <span>Salas ativas</span>
            <strong>{snapshot?.rooms.length ?? "—"}</strong>
          </article>
          <article>
            <span>Pessoas conectadas</span>
            <strong>{snapshot?.totalParticipants ?? "—"}</strong>
          </article>
          <article>
            <span>Transmissões de tela</span>
            <strong>{snapshot ? activeScreenShares : "—"}</strong>
          </article>
        </section>

        {!snapshot ? (
          <section className="admin-loading" aria-live="polite">
            <span className="admin-loading-spinner" aria-hidden="true" />
            <div>
              <strong>Consultando o LiveKit</strong>
              <p>Buscando as sessões ativas e seus participantes…</p>
            </div>
          </section>
        ) : snapshot.rooms.length === 0 ? (
          <section className="admin-empty-state">
            <span className="admin-empty-icon" aria-hidden="true">✓</span>
            <h2>Nenhuma sessão ativa</h2>
            <p>As salas aparecerão aqui assim que alguém entrar.</p>
          </section>
        ) : (
          <section className="admin-room-list" aria-label="Salas ativas">
            {snapshot.rooms.map((room) => (
              <RoomCard key={room.sid || room.name} room={room} now={now} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
