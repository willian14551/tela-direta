import type { Metadata, Viewport } from "next";
import "@livekit/components-styles";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Tela Direta — compartilhamento de tela ao vivo",
  description:
    "Crie uma sala em segundos e compartilhe sua tela com quem tiver o link. Sem instalar nada.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12142B",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}