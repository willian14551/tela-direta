"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  usePinnedTracks,
  type LayoutContextType,
  type TrackReferenceOrPlaceholder,
  type WidgetState,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export function isSameTrackReference(
  first: TrackReferenceOrPlaceholder | undefined,
  second: TrackReferenceOrPlaceholder | undefined,
) {
  if (!first || !second) return false;

  const firstTrackSid = first.publication?.trackSid;
  const secondTrackSid = second.publication?.trackSid;
  if (firstTrackSid && secondTrackSid) return firstTrackSid === secondTrackSid;

  return (
    first.participant.identity === second.participant.identity &&
    first.source === second.source
  );
}

/**
 * Mantém a interface original do VideoConference, mas usa um contexto de foco
 * fornecido pelo componente pai. Dessa forma, os controles externos sabem qual
 * participante ou transmissão o usuário maximizou.
 */
export function SyncedVideoConference({
  tracks,
  layoutContext,
}: {
  tracks: TrackReferenceOrPlaceholder[];
  layoutContext: LayoutContextType;
}) {
  const [widgetState, setWidgetState] = useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack =
    useRef<TrackReferenceOrPlaceholder | null>(null);
  const focusTrack = usePinnedTracks(layoutContext)[0];
  const screenShareTracks = useMemo(
    () =>
      tracks
        .filter(isTrackReference)
        .filter(
          (track) => track.publication.source === Track.Source.ScreenShare,
        ),
    [tracks],
  );
  const carouselTracks = useMemo(
    () =>
      tracks.filter((track) => !isSameTrackReference(track, focusTrack)),
    [focusTrack, tracks],
  );
  const screenShareState = screenShareTracks
    .map(
      (track) =>
        `${track.publication.trackSid}_${track.publication.isSubscribed}`,
    )
    .join();

  useEffect(() => {
    const subscribedScreenShare = screenShareTracks.find(
      (track) => track.publication.isSubscribed,
    );
    const autoFocusedTrack = lastAutoFocusedScreenShareTrack.current;
    const autoFocusedTrackStillExists =
      autoFocusedTrack &&
      screenShareTracks.some((track) =>
        isSameTrackReference(track, autoFocusedTrack),
      );

    if (autoFocusedTrack && !autoFocusedTrackStillExists) {
      // Só limpa o foco se ele ainda for o escolhido automaticamente. Caso o
      // usuário tenha selecionado outra transmissão, essa escolha é preservada.
      const removedTrackWasFocused = isSameTrackReference(
        focusTrack,
        autoFocusedTrack,
      );
      lastAutoFocusedScreenShareTrack.current = null;

      if ((removedTrackWasFocused || !focusTrack) && subscribedScreenShare) {
        layoutContext.pin.dispatch?.({
          msg: "set_pin",
          trackReference: subscribedScreenShare,
        });
        lastAutoFocusedScreenShareTrack.current = subscribedScreenShare;
      } else if (removedTrackWasFocused) {
        layoutContext.pin.dispatch?.({ msg: "clear_pin" });
      }
    } else if (!focusTrack && autoFocusedTrackStillExists) {
      // A transmissão continua ativa, portanto a ausência de foco foi uma
      // escolha manual e não deve ser desfeita automaticamente.
      lastAutoFocusedScreenShareTrack.current = null;
    } else if (subscribedScreenShare && !focusTrack && !autoFocusedTrack) {
      layoutContext.pin.dispatch?.({
        msg: "set_pin",
        trackReference: subscribedScreenShare,
      });
      lastAutoFocusedScreenShareTrack.current = subscribedScreenShare;
    }

    // Substitui um placeholder da câmera pela publicação real sem perder o
    // participante que estava selecionado.
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (track) =>
          track.participant.identity === focusTrack.participant.identity &&
          track.source === focusTrack.source,
      );
      if (
        updatedFocusTrack &&
        updatedFocusTrack !== focusTrack &&
        isTrackReference(updatedFocusTrack)
      ) {
        layoutContext.pin.dispatch?.({
          msg: "set_pin",
          trackReference: updatedFocusTrack,
        });
      }
    }
  }, [
    focusTrack,
    layoutContext.pin.dispatch,
    screenShareState,
    screenShareTracks,
    tracks,
  ]);

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider
        value={layoutContext}
        onWidgetChange={setWidgetState}
      >
        <div className="lk-video-conference-inner">
          {!focusTrack ? (
            <div className="lk-grid-layout-wrapper">
              <GridLayout tracks={tracks}>
                <ParticipantTile />
              </GridLayout>
            </div>
          ) : (
            <div className="lk-focus-layout-wrapper">
              <FocusLayoutContainer>
                <CarouselLayout tracks={carouselTracks}>
                  <ParticipantTile />
                </CarouselLayout>
                <FocusLayout trackRef={focusTrack} />
              </FocusLayoutContainer>
            </div>
          )}
          <ControlBar controls={{ chat: true }} />
        </div>
        <Chat style={{ display: widgetState.showChat ? "grid" : "none" }} />
      </LayoutContextProvider>
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}
