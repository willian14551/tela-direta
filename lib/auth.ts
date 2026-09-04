import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { isDiscordGuildMember } from "@/lib/discord";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      // Auth.js v5 usa AUTH_DISCORD_ID/SECRET. Os nomes antigos continuam
      // aceitos como fallback para facilitar a migração do projeto.
      clientId: process.env.AUTH_DISCORD_ID || process.env.DISCORD_CLIENT_ID,
      clientSecret:
        process.env.AUTH_DISCORD_SECRET || process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "identify guilds",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // A associação ao servidor é confirmada novamente no próximo login.
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== "discord") {
        return false;
      }

      const guildId = process.env.DISCORD_GUILD_ID;

      if (!guildId || !account.access_token) {
        console.error(
          "[auth] DISCORD_GUILD_ID ausente ou access token não recebido.",
        );
        return "/auth/error?error=DiscordVerificationFailed";
      }

      try {
        return await isDiscordGuildMember(account.access_token, guildId);
      } catch (error) {
        console.error("[auth] Falha ao validar o servidor do Discord:", error);
        return "/auth/error?error=DiscordVerificationFailed";
      }
    },
    async jwt({ token, account }) {
      if (account?.provider === "discord") {
        token.discordId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.discordId && session.user) {
        session.user.discordId = token.discordId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
