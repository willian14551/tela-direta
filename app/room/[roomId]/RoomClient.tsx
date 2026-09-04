"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";

type ConnInfo = { token: string; livekitUrl: string };

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
