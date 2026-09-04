"use client";
import { useSearchParams } from "next/navigation";

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

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
        <p className="lede">
          {error === "AccessDenied"
            ? "Você não tem permissão para acessar este site. Apenas membros do servidor do Discord podem entrar."
            : "Ocorreu um erro ao fazer login. Tente novamente."}
        </p>
        <div className="panel">
          <a href="/" className="btn btn-primary">
            Voltar para o início
          </a>
        </div>
      </main>
    </div>
  );
}