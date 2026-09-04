"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isTrackReference,
  TrackToggle,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoConference,
  VideoTrack,
} from "@livekit/components-react";
import {
  AudioPresets,
  ScreenSharePresets,
  Track,
  type RemoteParticipant,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";

const RESOLUTION_OPTIONS = {
  "480p": { label: "480p", width: 854, height: 480 },
  "720p": { label: "720p", width: 1280, height: 720 },
  "1080p": { label: "1080p", width: 1920, height: 1080 },
} as const;
const FRAME_RATE_OPTIONS = [15, 30] as const;

type AudioSource =
  | Track.Source.Microphone
  | Track.Source.ScreenShareAudio;
type OpenPanel = "audio" | "quality" | null;
type ResolutionKey = keyof typeof RESOLUTION_OPTIONS;
type FrameRate = (typeof FRAME_RATE_OPTIONS)[number];

type SafariFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type SafariFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

// Mantém o transmissor preparado para a qualidade máxima. Resoluções menores
// são controladas na captura, o que também permite trocar durante a transmissão.
const SCREEN_SHARE_PUBLISH_OPTIONS: TrackPublishOptions = {
  screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
  audioPreset: AudioPresets.musicHighQualityStereo,
  degradationPreference: "maintain-resolution",
  dtx: false,
  forceStereo: true,
  red: false,
};

function getFullscreenElement(doc: SafariFullscreenDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function getVolumeKey(participant: RemoteParticipant, source: AudioSource) {
  return JSON.stringify([participant.identity, source]);
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

function QualityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4M7 9h4M7 13h7" />
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

export function ConferenceExperience() {
  const participants = useRemoteParticipants();
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const activeScreenShare = screenShareTracks.find(isTrackReference);
  const hasScreenShare = Boolean(activeScreenShare);

  const stageRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAudibleVolumes = useRef<Record<string, number>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [resolution, setResolution] = useState<ResolutionKey>("1080p");
  const [frameRate, setFrameRate] = useState<FrameRate>(30);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [qualityStatus, setQualityStatus] = useState<string | null>(null);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [echoProtectionSupported, setEchoProtectionSupported] = useState<
    boolean | null
  >(null);

  const selectedResolution = RESOLUTION_OPTIONS[resolution];
  const screenCaptureOptions = useMemo<ScreenShareCaptureOptions>(
    () => ({
      // Evita processamento de voz no som do jogo/vídeo e pede ao navegador
      // para remover da captura as vozes reproduzidas pelo próprio Tela Direta.
      audio: {
        autoGainControl: false,
        channelCount: 2,
        echoCancellation: false,
        noiseSuppression: false,
        restrictOwnAudio: true,
      },
      video: true,
      resolution: {
        width: selectedResolution.width,
        height: selectedResolution.height,
        frameRate,
      },
      contentHint: frameRate === 30 ? "motion" : "detail",
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
      systemAudio: "include",
    }),
    [frameRate, selectedResolution],
  );

  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = null;
    }
  }, []);

  const revealControls = useCallback(() => {
    clearHideControlsTimer();
    setControlsVisible(true);
    if (hasScreenShare && openPanel === null) {
      hideControlsTimer.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2800);
    }
  }, [clearHideControlsTimer, hasScreenShare, openPanel]);

  const keepControlsVisible = useCallback(() => {
    clearHideControlsTimer();
    setControlsVisible(true);
  }, [clearHideControlsTimer]);

  useEffect(() => {
    revealControls();
    return clearHideControlsTimer;
  }, [clearHideControlsTimer, revealControls]);

  useEffect(() => {
    const supportedConstraints =
      navigator.mediaDevices?.getSupportedConstraints?.();
    setEchoProtectionSupported(
      Boolean(
        supportedConstraints && "restrictOwnAudio" in supportedConstraints,
      ),
    );
  }, []);

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

  // Os dois tipos de áudio começam explicitamente em 100%. O LiveKit guarda o
  // valor por fonte, então o ajuste continua válido se a trilha for recriada.
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
      participant.setVolume(
        (volumes[microphoneKey] ?? 100) / 100,
        Track.Source.Microphone,
      );
      participant.setVolume(
        (volumes[screenKey] ?? 100) / 100,
        Track.Source.ScreenShareAudio,
      );
    });
  }, [participants, volumes]);

  // Atualiza a captura atual sem obrigar o usuário a escolher a janela de novo.
  useEffect(() => {
    const publication = localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    );
    const mediaTrack = publication?.track?.mediaStreamTrack;
    if (!isScreenShareEnabled || !mediaTrack) {
      setQualityStatus(null);
      setQualityError(null);
      return;
    }

    let effectActive = true;
    mediaTrack.contentHint = frameRate === 30 ? "motion" : "detail";
    mediaTrack
      .applyConstraints({
        width: {
          ideal: selectedResolution.width,
          max: selectedResolution.width,
        },
        height: {
          ideal: selectedResolution.height,
          max: selectedResolution.height,
        },
        frameRate: { ideal: frameRate, max: frameRate },
      })
      .then(() => {
        if (!effectActive) return;
        const settings = mediaTrack.getSettings();
        const appliedHeight = settings.height ?? selectedResolution.height;
        const appliedFrameRate = Math.round(settings.frameRate ?? frameRate);
        setQualityError(null);
        setQualityStatus(
          `Aplicado: ${appliedHeight}p • ${appliedFrameRate} FPS`,
        );
      })
      .catch(() => {
        if (!effectActive) return;
        setQualityStatus(null);
        setQualityError(
          "O navegador não alterou a transmissão atual. Pare e compartilhe novamente para aplicar.",
        );
      });

    return () => {
      effectActive = false;
    };
  }, [frameRate, isScreenShareEnabled, localParticipant, selectedResolution]);

  // Se a transmissão terminar, não deixa uma tela cheia preta presa na tela.
  useEffect(() => {
    if (hasScreenShare || !isFullscreen) return;
    const doc = document as SafariFullscreenDocument;
    const exitFullscreen = document.exitFullscreen
      ? document.exitFullscreen.bind(document)
      : doc.webkitExitFullscreen?.bind(doc);
    void Promise.resolve(exitFullscreen?.()).catch(() => undefined);
  }, [hasScreenShare, isFullscreen]);

  function currentVolume(participant: RemoteParticipant, source: AudioSource) {
    return volumes[getVolumeKey(participant, source)] ?? 100;
  }

  function updateVolume(
    participant: RemoteParticipant,
    source: AudioSource,
    value: number,
  ) {
    const key = getVolumeKey(participant, source);
    const nextVolume = Math.max(0, Math.min(100, value));
    if (nextVolume > 0) lastAudibleVolumes.current[key] = nextVolume;
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

  function togglePanel(panel: Exclude<OpenPanel, null>) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  async function toggleFullscreen() {
    const target = stageRef.current as SafariFullscreenElement | null;
    const doc = document as SafariFullscreenDocument;
    if (!target || (!hasScreenShare && !getFullscreenElement(doc))) return;

    setFullscreenError(null);
    try {
      if (getFullscreenElement(doc)) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
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

  const stageClassName = [
    "conference-stage",
    hasScreenShare ? "has-screen-share" : "",
    isFullscreen ? "is-screen-fullscreen" : "",
    controlsVisible ? "" : "controls-hidden",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={stageRef}
      className={stageClassName}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onKeyDown={revealControls}
      onFocusCapture={keepControlsVisible}
      onBlurCapture={revealControls}
    >
      <VideoConference />

      {isFullscreen && activeScreenShare && (
        <div className="fullscreen-screen-share">
          <VideoTrack
            trackRef={activeScreenShare}
            className="fullscreen-screen-share-video"
          />
        </div>
      )}

      <div className="conference-tools" aria-label="Controles da transmissão">
        <TrackToggle
          source={Track.Source.ScreenShare}
          captureOptions={screenCaptureOptions}
          publishOptions={SCREEN_SHARE_PUBLISH_OPTIONS}
          className={`conference-tool-button conference-share-button${
            isScreenShareEnabled ? " is-sharing" : ""
          }`}
          onDeviceError={() =>
            setScreenShareError(
              "Não foi possível iniciar o compartilhamento. Confira a permissão do navegador.",
            )
          }
          onChange={(enabled) => {
            if (enabled) setScreenShareError(null);
          }}
          title={
            isScreenShareEnabled
              ? "Parar compartilhamento"
              : "Compartilhar tela"
          }
        >
          <span>{isScreenShareEnabled ? "Parar" : "Compartilhar"}</span>
        </TrackToggle>

        <button
          type="button"
          className={`conference-tool-button${openPanel === "audio" ? " is-active" : ""}`}
          onClick={() => togglePanel("audio")}
          aria-expanded={openPanel === "audio"}
          aria-controls="audio-mixer"
          title="Volumes individuais"
        >
          <MixerIcon />
          <span>Áudio</span>
        </button>

        <button
          type="button"
          className={`conference-tool-button${openPanel === "quality" ? " is-active" : ""}`}
          onClick={() => togglePanel("quality")}
          aria-expanded={openPanel === "quality"}
          aria-controls="quality-settings"
          title="Qualidade da transmissão"
        >
          <QualityIcon />
          <span>Qualidade</span>
        </button>

        <button
          type="button"
          className="conference-tool-button"
          onClick={toggleFullscreen}
          disabled={!fullscreenSupported || (!hasScreenShare && !isFullscreen)}
          title={
            !hasScreenShare && !isFullscreen
              ? "Disponível quando houver uma transmissão"
              : isFullscreen
                ? "Sair da tela cheia"
                : "Ver transmissão em tela cheia"
          }
        >
          <FullscreenIcon active={isFullscreen} />
          <span>{isFullscreen ? "Sair" : "Tela cheia"}</span>
        </button>
      </div>

      {openPanel === "audio" && (
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
              onClick={() => setOpenPanel(null)}
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
                      <span
                        className="participant-volume-avatar"
                        aria-hidden="true"
                      >
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

      {openPanel === "quality" && (
        <aside
          id="quality-settings"
          className="audio-mixer quality-panel"
          role="dialog"
          aria-label="Qualidade da transmissão"
        >
          <div className="audio-mixer-header">
            <div>
              <h2>Qualidade da transmissão</h2>
              <p>Defina como você compartilha sua tela.</p>
            </div>
            <button
              type="button"
              className="audio-mixer-close"
              onClick={() => setOpenPanel(null)}
              aria-label="Fechar configurações de qualidade"
            >
              ×
            </button>
          </div>
          <div className="quality-panel-content">
            <fieldset className="quality-fieldset">
              <legend>Resolução</legend>
              <div className="quality-options">
                {(Object.keys(RESOLUTION_OPTIONS) as ResolutionKey[]).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      className={`quality-option${resolution === option ? " is-selected" : ""}`}
                      onClick={() => setResolution(option)}
                      aria-pressed={resolution === option}
                    >
                      {RESOLUTION_OPTIONS[option].label}
                    </button>
                  ),
                )}
              </div>
            </fieldset>

            <fieldset className="quality-fieldset">
              <legend>Quadros por segundo</legend>
              <div className="quality-options quality-options-fps">
                {FRAME_RATE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`quality-option${frameRate === option ? " is-selected" : ""}`}
                    onClick={() => setFrameRate(option)}
                    aria-pressed={frameRate === option}
                  >
                    {option} FPS
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="quality-summary">
              <strong>
                {selectedResolution.label} • {frameRate} FPS
              </strong>
              <span>
                {frameRate === 30
                  ? "Mais fluido para jogos e vídeos."
                  : "Menor uso de internet e processamento."}
              </span>
            </div>
            <p
              className={`echo-protection-note${
                echoProtectionSupported === false ? " is-warning" : ""
              }`}
            >
              {echoProtectionSupported === false
                ? "Este navegador não oferece o filtro de eco da tela. Use fones para impedir o retorno das vozes."
                : "Proteção contra retorno das vozes ativada para navegadores compatíveis."}
            </p>
            {isScreenShareEnabled && qualityStatus && (
              <p className="quality-status" role="status">
                {qualityStatus}
              </p>
            )}
            {qualityError && (
              <p className="quality-error" role="alert">
                {qualityError}
              </p>
            )}
          </div>
        </aside>
      )}

      {(fullscreenError || screenShareError) && (
        <p className="fullscreen-error" role="status">
          {fullscreenError || screenShareError}
        </p>
      )}
    </div>
  );
}
