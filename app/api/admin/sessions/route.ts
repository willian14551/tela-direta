import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminDiscordId } from "@/lib/admin";
import { getActiveSessions } from "@/lib/admin-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  const session = await auth();

  if (!session?.user?.discordId) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  if (!isAdminDiscordId(session.user.discordId)) {
    return NextResponse.json(
      { error: "Acesso administrativo necessário" },
      { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  try {
    const snapshot = await getActiveSessions();
    return NextResponse.json(snapshot, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    console.error("[admin] Falha ao consultar sessões ativas:", error);
    return NextResponse.json(
      { error: "Não foi possível consultar o LiveKit agora" },
      { status: 502, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
