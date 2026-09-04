"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  return (
    <div className="panel">
      <button
        className="btn btn-primary"
        onClick={() => signIn("discord", { redirectTo: callbackUrl })}
      >
        Entrar com Discord
      </button>
      {error && (
        <p className="error-text">
          {error === "AccessDenied"
            ? "Você não é membro do servidor autorizado."
            : error === "DiscordVerificationFailed"
              ? "Não foi possível confirmar seu servidor no Discord. Tente novamente em instantes."
              : "Erro ao fazer login. Tente novamente."}
        </p>
      )}
      <p className="hint">
        <strong>Importante:</strong> você precisa estar no servidor do Discord
        para conseguir entrar. Se não for membro, peça um convite.
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="page">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Tela Direta
        </div>
      </header>
      <main className="hero">
        <h1>Acesso restrito</h1>
        <p className="lede">
          Este site é exclusivo para membros do servidor do Discord. Faça login
          para continuar.
        </p>
        <Suspense
          fallback={
            <div className="panel">
              <p>Carregando...</p>
            </div>
          }
        >
          <SignInForm />
        </Suspense>
      </main>
    </div>
  );
}
