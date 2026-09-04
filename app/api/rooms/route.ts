import { NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();

  if (!session?.user?.discordId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { roomId, secret } = createRoom();
    // O "secret" só é devolvido nesta resposta. O cliente o coloca no
    // fragmento (#s=...), que não aparece em requisições GET nem em logs HTTP.
    return NextResponse.json({ roomId, secret });
  } catch (error) {
    console.error("[rooms] Falha ao criar sala:", error);
    return NextResponse.json(
      { error: "Configuração do servidor incompleta" },
      { status: 500 },
    );
  }
}
