import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELADIRETA_BOT_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Endpoint de bot desativado" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");

  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const { roomId, secret } = createRoom();

  return NextResponse.json({ roomId, secret });
}