import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdminDiscordId } from "@/lib/admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sessões ativas — Tela Direta",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.discordId) {
    redirect("/auth/signin?callbackUrl=%2Fadmin");
  }

  if (!isAdminDiscordId(session.user.discordId)) {
    return (
      <div className="page">
        <header className="top-bar">
          <a className="brand" href="/">
            <span className="brand-dot" aria-hidden="true" />
            Tela Direta
          </a>
        </header>
        <main className="hero">
          <h1>Acesso administrativo</h1>
          <p className="lede">
            Sua conta do Discord não tem permissão para visualizar as sessões.
          </p>
          <div className="panel admin-denied-panel">
            <p className="status-line">
              O painel é restrito aos administradores configurados pelo
              responsável do site.
            </p>
            <a className="btn btn-primary" href="/">
              Voltar ao início
            </a>
          </div>
        </main>
      </div>
    );
  }

  return <AdminDashboard adminName={session.user.name || "Administrador"} />;
}
