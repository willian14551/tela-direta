"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [creating, setCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao criar a sala");
      const { roomId, secret } = await res.json();
      router.push(`/room/${roomId}#s=${secret}`);
    } catch (e) {
      setError("Não foi possível criar a sala agora. Tente de novo.");
      setCreating(false);
    }
  }

  function handleJoinFromLink() {
    setError(null);
    const trimmed = inviteLink.trim();
    if (!trimmed) {
      setError("Cole o link do convite que você recebeu.");
      return;
    }
    try {
      const url = new URL(trimmed, window.location.origin);
      if (!url.pathname.startsWith("/room/") || !url.hash.startsWith("#s=")) {
        throw new Error("invalid");
      }
      router.push(`${url.pathname}${url.hash}`);
    } catch {
      setError("Esse link não parece válido. Confira e cole de novo.");
    }
  }

  if (status === "loading") {
    return (
      <div className="page">
        <header className="top-bar">
          <div className="brand">
            <span className="brand-dot" aria-hidden="true" />
            Tela Direta
          </div>
        </header>
        <main className="hero">
          <p>Carregando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Tela Direta
        </div>
        {session && (
          <div className="top-bar-actions">
            {session.user?.isAdmin && (
              <a className="btn btn-secondary" href="/admin">
                Painel
              </a>
            )}
            <button className="btn btn-secondary" onClick={() => signOut()}>
              Sair
            </button>
          </div>
        )}
      </header>
      <main className="hero">
        <h1>Compartilhe sua tela com quem tiver o link</h1>
        <p className="lede">
          Sem instalar nada. Você cria uma sala, envia o link para as pessoas e
          todo mundo pode ver — ou compartilhar — a tela em tempo real.
        </p>
        <div className="panel">
          {!session ? (
            <>
              <p className="status-line">
                Faça login com Discord para criar ou entrar em salas.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => signIn("discord", { redirectTo: "/" })}
              >
                Entrar com Discord
              </button>
              <p className="hint">
                <strong>Acesso restrito:</strong> apenas membros do servidor do
                Discord podem usar este site.
              </p>
            </>
          ) : (
            <>
              <p className="status-line">
                Olá, {session.user?.name || "usuário"}!
              </p>
              <button
                className="btn btn-primary"
                onClick={handleCreateRoom}
                disabled={creating}
              >
                {creating ? "Criando sala…" : "Criar uma sala"}
              </button>
              <div className="divider">OU</div>
              <div className="field">
                <label htmlFor="invite">Entrar com um link de convite</label>
                <input
                  id="invite"
                  type="text"
                  inputMode="url"
                  placeholder="Cole aqui o link que você recebeu"
                  value={inviteLink}
                  onChange={(e) => setInviteLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoinFromLink();
                  }}
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleJoinFromLink}
              >
                Entrar na sala
              </button>
              {error && <p className="error-text">{error}</p>}
              <p className="hint">
                <strong>Como funciona a segurança:</strong> a chave de acesso da
                sala vai só na parte do link depois de <code>#</code>, então ela
                nunca é enviada aos nossos servidores em uma requisição comum —
                só quem tem o link completo consegue entrar. O convite expira em
                24 horas.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
