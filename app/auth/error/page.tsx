"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="panel">
      <p className="lede" style={{ textAlign: "center", marginBottom: 20 }}>
        {error === "AccessDenied"
          ? "Você não tem permissão para acessar este site. Apenas membros do servidor do Discord podem entrar."
          : "Ocorreu um erro ao fazer login. Tente novamente."}
      </p>
      <a href="/" className="btn btn-primary" style={{ textAlign: "center" }}>
        Voltar para o início
      </a>
    </div>
  );
}

export default function AuthError() {
  return (
    <div className="page">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Tela Direta
        </div>
      </header>
      <main className="hero">
        <h1>Erro de autenticação</h1>
        <Suspense fallback={<div className="panel"><p>Carregando...</p></div>}>
          <ErrorContent />
        </Suspense>
      </main>
    </div>
  );
}