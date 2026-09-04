import { NextRequest, NextResponse } from "next/server";
import { verifyRoomSecret } from "@/lib/rooms";
import { mintParticipantToken } from "@/lib/livekit";

export async function POST(req: NextRequest) {
  let body: { roomId?: string; secret?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { roomId, secret, name } = body;

  if (!roomId || !secret || !name) {
    return NextResponse.json(
      { error: "roomId, secret e name são obrigatórios" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim().slice(0, 60);
  if (trimmedName.length === 0) {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
  }

  if (!verifyRoomSecret(roomId, secret)) {
    return NextResponse.json(
      { error: "Link inválido ou expirado" },
      { status: 403 }
    );
  }

  try {
    const { token, livekitUrl } = await mintParticipantToken(
      roomId,
      trimmedName
    );
    return NextResponse.json({ token, livekitUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Falha ao gerar credencial de acesso" },
      { status: 500 }
    );
  }
}
