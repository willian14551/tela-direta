import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isRoomRoute = req.nextUrl.pathname.startsWith("/room/");
  const isTokenRoute = req.nextUrl.pathname === "/api/token";

  if (isRoomRoute || isTokenRoute) {
    if (!req.auth) {
      // Redireciona para login
      const loginUrl = new URL("/auth/signin", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/room/:path*", "/api/token"],
};