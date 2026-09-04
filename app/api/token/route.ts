import { NextRequest, NextResponse } from "next/server";
import { verifyRoomSecret } from "@/lib/rooms";
import { mintParticipantToken } from "@/lib/livekit";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { roomId?: string; secret?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { roomId, secret, name } = body;

  if (
    typeof roomId !== "string" ||
    typeof secret !== "string" ||
    typeof name !== "string"
  ) {
    return NextResponse.json(
      { error: "roomId, secret e name são obrigatórios" },
      { status: 400 },
    );
  }

  const trimmedName = name.trim().slice(0, 60);
  if (trimmedName.length === 0) {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
  }

  try {
    if (!verifyRoomSecret(roomId, secret)) {
      return NextResponse.json(
        { error: "Link inválido ou expirado" },
        { status: 403 },
      );
    }

    const { token, livekitUrl } = await mintParticipantToken(
      roomId,
      trimmedName,
      session.user.discordId,
    );
    return NextResponse.json({ token, livekitUrl });
  } catch (err) {
    console.error("[token] Falha ao gerar credencial:", err);
    return NextResponse.json(
      { error: "Falha ao gerar credencial de acesso" },
      { status: 500 },
    );
  }
}
