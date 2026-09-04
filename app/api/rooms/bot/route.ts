import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

function secretsMatch(received: string | null, expected: string): boolean {
  if (!received?.startsWith("Bearer ")) return false;

  const receivedSecret = Buffer.from(received.slice(7), "utf8");
  const expectedSecret = Buffer.from(expected, "utf8");

  if (receivedSecret.length !== expectedSecret.length) return false;
  return timingSafeEqual(receivedSecret, expectedSecret);
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELADIRETA_BOT_SECRET;

  if (!expectedSecret || expectedSecret.length < 32) {
    return NextResponse.json(
      { error: "Endpoint de bot desativado" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");

  if (!secretsMatch(auth, expectedSecret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { roomId, secret } = createRoom();
    return NextResponse.json({ roomId, secret });
  } catch (error) {
    console.error("[rooms/bot] Falha ao criar sala:", error);
    return NextResponse.json(
      { error: "Configuração do servidor incompleta" },
      { status: 500 },
    );
  }
}
