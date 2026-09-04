"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";

type ConnInfo = { token: string; livekitUrl: string };

export default function RoomClient({ roomId }: { roomId: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnInfo | null>(null);
  const [copied, setCopied] = useState(false);

  // O segredo vive só no fragmento do link (#s=...), então só existe
  // no navegador — nunca é enviado numa requisição GET comum.
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[#&]s=([^&]+)/);
    setSecret(match ? decodeURIComponent(match[1]) : "");
  }, []);

  async function handleJoin() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Digite seu nome para entrar.");
      return;
    }
    if (!secret) {
      setError(
        "Esse link está incompleto. Peça para quem te convidou reenviar o link inteiro."
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
      // silencioso: navegador pode bloquear clipboard fora de HTTPS/localhost
    }
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
          data-lk-theme="default"
          style={{ height: "100dvh" }}
          onDisconnected={() => setConn(null)}
        >
          <VideoConference />
          <RoomAudioRenderer />
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
            disabled={secret === null}
          >
            {copied ? "Link copiado!" : "Copiar convite"}
          </button>
        </div>
      </header>

      <div className="join-screen">
        <div className="panel">
          <h2 style={{ margin: 0, fontSize: 20 }}>Entrar na sala</h2>
          <p className="status-line">
            Ninguém foi avisado ainda — assim que você entrar, poderá
            compartilhar sua tela ou ver a de outra pessoa.
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
