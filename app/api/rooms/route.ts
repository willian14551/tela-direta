import { NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";

export async function POST() {
  const { roomId, secret } = createRoom();
  // O "secret" só é devolvido nesta resposta, uma única vez.
  // O cliente coloca ele no fragmento do link (#s=...) e nunca mais
  // ele passa por uma requisição GET ou por logs do servidor.
  return NextResponse.json({ roomId, secret });
}
