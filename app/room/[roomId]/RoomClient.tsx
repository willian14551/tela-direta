"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  LiveKitRoom,
  VideoConference,
  useRemoteParticipants,
} from "@livekit/components-react";
import { Track, type RemoteParticipant } from "livekit-client";

type ConnInfo = { token: string; livekitUrl: string };
type AudioSource =
  | Track.Source.Microphone
  | Track.Source.ScreenShareAudio;

type SafariFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type SafariFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

function getFullscreenElement(doc: SafariFullscreenDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function getVolumeKey(participant: RemoteParticipant, source: AudioSource) {
  return `${participant.identity}:${source}`;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Zm4.5 5.5 5 5m0-5-5 5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Zm4 4a4.25 4.25 0 0 1 0 6m2.75-8.75a8 8 0 0 1 0 11.5" />
    </svg>
  );
}

function MixerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M10 14v6" />
    </svg>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5" />
    </svg>
  );
}

function VolumeControl({
  participant,
  source,
  label,
  value,
  onChange,
  onToggleMute,
}: {
  participant: RemoteParticipant;
  source: AudioSource;
  label: string;
  value: number;
  onChange: (value: number) => void;
  onToggleMute: () => void;
}) {
  const participantName = participant.name || participant.identity;
  const muted = value === 0;

  return (
    <div className="volume-control">
      <div className="volume-control-label">
        <span>{label}</span>
        <output aria-live="off">{value}%</output>
      </div>
      <div className="volume-control-inputs">
        <button
          type="button"
          className={`volume-mute-button${muted ? " is-muted" : ""}`}
          onClick={onToggleMute}
          aria-label={`${muted ? "Ativar" : "Silenciar"} ${label.toLowerCase()} de ${participantName}`}
          aria-pressed={muted}
        >
          <SpeakerIcon muted={muted} />
        </button>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          aria-label={`Volume de ${label.toLowerCase()} de ${participantName}`}
          style={{
            background: `linear-gradient(to right, var(--accent) ${value}%, var(--border) ${value}%)`,
          }}
        />
      </div>
    </div>
  );
}

function ConferenceExperience() {
  const participants = useRemoteParticipants();
  const stageRef = useRef<HTMLDivElement>(null);
  const lastAudibleVolumes = useRef<Record<string, number>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(true);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    const doc = document as SafariFullscreenDocument;
    const handleFullscreenChange = () => {
      setIsFullscreen(getFullscreenElement(doc) === stageRef.current);
    };

    setFullscreenSupported(
      Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled),
    );
    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  useEffect(() => {
    participants.forEach((participant) => {
      const microphoneKey = getVolumeKey(
        participant,
        Track.Source.Microphone,
      );
      const screenKey = getVolumeKey(
        participant,
        Track.Source.ScreenShareAudio,
      );

      if (volumes[microphoneKey] !== undefined) {
        participant.setVolume(
          volumes[microphoneKey] / 100,
          Track.Source.Microphone,
        );
      }
      if (volumes[screenKey] !== undefined) {
        participant.setVolume(
          volumes[screenKey] / 100,
          Track.Source.ScreenShareAudio,
        );
      }
    });
  }, [participants, volumes]);

  function currentVolume(participant: RemoteParticipant, source: AudioSource) {
    const key = getVolumeKey(participant, source);
    const savedVolume = volumes[key];

    if (savedVolume !== undefined) return savedVolume;
    return Math.round((participant.getVolume(source) ?? 1) * 100);
  }

  function updateVolume(
    participant: RemoteParticipant,
    source: AudioSource,
    value: number,
  ) {
    const key = getVolumeKey(participant, source);
    const nextVolume = Math.max(0, Math.min(100, value));

    if (nextVolume > 0) {
      lastAudibleVolumes.current[key] = nextVolume;
    }
    participant.setVolume(nextVolume / 100, source);
    setVolumes((current) => ({ ...current, [key]: nextVolume }));
  }

  function toggleMute(participant: RemoteParticipant, source: AudioSource) {
    const key = getVolumeKey(participant, source);
    const volume = currentVolume(participant, source);
    updateVolume(
      participant,
      source,
      volume === 0 ? (lastAudibleVolumes.current[key] ?? 100) : 0,
    );
  }

  async function toggleFullscreen() {
    const target = stageRef.current as SafariFullscreenElement | null;
    const doc = document as SafariFullscreenDocument;
    if (!target) return;

    setFullscreenError(null);
    try {
      if (getFullscreenElement(doc)) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else {
          await doc.webkitExitFullscreen?.();
        }
      } else if (target.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: "hide" });
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      } else {
        throw new Error("Fullscreen API indisponível");
      }
    } catch {
      setFullscreenError(
        "O navegador bloqueou a tela cheia. Tente novamente ou pressione F11.",
      );
    }
  }

  return (
    <div ref={stageRef} className="conference-stage">
      <VideoConference />

      <div className="conference-tools" aria-label="Controles da sala">
        <button
          type="button"
          className={`conference-tool-button${isMixerOpen ? " is-active" : ""}`}
          onClick={() => setIsMixerOpen((open) => !open)}
          aria-expanded={isMixerOpen}
          aria-controls="audio-mixer"
          title="Volumes individuais"
        >
          <MixerIcon />
          <span>Áudio</span>
        </button>
        <button
          type="button"
          className="conference-tool-button"
          onClick={toggleFullscreen}
          disabled={!fullscreenSupported}
          title={
            fullscreenSupported
              ? isFullscreen
                ? "Sair da tela cheia"
                : "Entrar em tela cheia"
              : "Tela cheia não disponível neste navegador"
          }
        >
          <FullscreenIcon active={isFullscreen} />
          <span>{isFullscreen ? "Sair" : "Tela cheia"}</span>
        </button>
      </div>

      {isMixerOpen && (
        <aside
          id="audio-mixer"
          className="audio-mixer"
          role="dialog"
          aria-label="Volumes individuais"
        >
          <div className="audio-mixer-header">
            <div>
              <h2>Volumes individuais</h2>
              <p>Só altera o que você escuta.</p>
            </div>
            <button
              type="button"
              className="audio-mixer-close"
              onClick={() => setIsMixerOpen(false)}
              aria-label="Fechar controles de áudio"
            >
              ×
            </button>
          </div>

          <div className="audio-mixer-list">
            {participants.length === 0 ? (
              <p className="audio-mixer-empty">
                Os controles aparecerão quando outra pessoa entrar.
              </p>
            ) : (
              participants.map((participant) => {
                const participantName =
                  participant.name || participant.identity;
                const hasScreenAudio = Boolean(
                  participant.getTrackPublication(
                    Track.Source.ScreenShareAudio,
                  ),
                );

                return (
                  <section
                    key={participant.identity}
                    className="participant-volume"
                  >
                    <div className="participant-volume-name">
                      <span className="participant-volume-avatar" aria-hidden="true">
                        {participantName.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <strong title={participantName}>{participantName}</strong>
                    </div>
                    <VolumeControl
                      participant={participant}
                      source={Track.Source.Microphone}
                      label="Voz"
                      value={currentVolume(
                        participant,
                        Track.Source.Microphone,
                      )}
                      onChange={(value) =>
                        updateVolume(
                          participant,
                          Track.Source.Microphone,
                          value,
                        )
                      }
                      onToggleMute={() =>
                        toggleMute(participant, Track.Source.Microphone)
                      }
                    />
                    {hasScreenAudio && (
                      <VolumeControl
                        participant={participant}
                        source={Track.Source.ScreenShareAudio}
                        label="Transmissão"
                        value={currentVolume(
                          participant,
                          Track.Source.ScreenShareAudio,
                        )}
                        onChange={(value) =>
                          updateVolume(
                            participant,
                            Track.Source.ScreenShareAudio,
                            value,
                          )
                        }
                        onToggleMute={() =>
                          toggleMute(
                            participant,
                            Track.Source.ScreenShareAudio,
                          )
                        }
                      />
                    )}
                  </section>
                );
              })
            )}
          </div>
        </aside>
      )}

      {fullscreenError && (
        <p className="fullscreen-error" role="status">
          {fullscreenError}
        </p>
      )}
    </div>
  );
}

export default function RoomClient({ roomId }: { roomId: string }) {
  const { data: session, status } = useSession();
  const [secret, setSecret] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const storageKey = `tela-direta:room:${roomId}:secret`;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const secretFromLink = hashParams.get("s");

    if (secretFromLink) {
      // sessionStorage mantém o segredo somente nesta aba durante o OAuth.
      // Assim ele não precisa virar um parâmetro de query enviado ao servidor.
      sessionStorage.setItem(storageKey, secretFromLink);
      setSecret(secretFromLink);
      return;
    }

    const storedSecret = sessionStorage.getItem(storageKey) || "";
    setSecret(storedSecret);

    if (storedSecret) {
      const restoredUrl = `${window.location.pathname}${window.location.search}#s=${encodeURIComponent(
        storedSecret,
      )}`;
      window.history.replaceState(null, "", restoredUrl);
    }
  }, [roomId]);

  async function handleJoin() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Digite seu nome para entrar.");
      return;
    }
    if (!secret) {
      setError(
        "Esse link está incompleto. Peça para quem te convidou reenviar o link inteiro.",
      );
      return;
    }
    setJoining(true);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, secret, name: trimmedName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível entrar na sala.");
      }
      setConn({ token: data.token, livekitUrl: data.livekitUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setJoining(false);
    }
  }

  async function handleCopyInvite() {
    const link = `${window.location.origin}/room/${roomId}#s=${secret ?? ""}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // silencioso
    }
  }

  if (status === "loading") {
    return (
      <div className="room-shell">
        <div className="join-screen">
          <div className="panel">
            <p>Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="room-shell">
        <div className="join-screen">
          <div className="panel">
            <h2>Acesso restrito</h2>
            <p className="status-line">
              Você precisa fazer login com Discord para entrar nesta sala.
            </p>
            <a
              href={`/auth/signin?callbackUrl=${encodeURIComponent(
                `/room/${roomId}`,
              )}`}
              className="btn btn-primary"
            >
              Entrar com Discord
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (conn) {
    return (
      <div className="room-shell">
        <LiveKitRoom
          serverUrl={conn.livekitUrl}
          token={conn.token}
          connect
          video={false}
          audio={false}
          options={{ webAudioMix: true }}
          data-lk-theme="default"
          style={{ height: "100dvh" }}
          onDisconnected={() => setConn(null)}
        >
          <ConferenceExperience />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="room-shell">
      <header className="room-header">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Tela Direta
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="room-code">{roomId}</span>
          <button
            className="btn btn-secondary copy-btn"
            onClick={handleCopyInvite}
            disabled={!secret}
          >
            {copied ? "Link copiado!" : "Copiar convite"}
          </button>
        </div>
      </header>
      <div className="join-screen">
        <div className="panel">
          <h2 style={{ margin: 0, fontSize: 20 }}>Entrar na sala</h2>
          <p className="status-line">
            Olá, {session.user?.name || "usuário"}! Digite como quer ser visto
            na sala.
          </p>
          <div className="field">
            <label htmlFor="name">Seu nome</label>
            <input
              id="name"
              type="text"
              autoFocus
              placeholder="Como as outras pessoas vão te ver"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={joining || secret === null}
          >
            {joining ? "Entrando…" : "Entrar"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </div>
  );
}
