import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      authorization: {
        params: {
          scope: "identify guilds",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "discord") {
        // Verifica se o usuário está no servidor autorizado
        const guilds = (profile as any).guilds || [];
        const isMember = guilds.some(
          (guild: { id: string }) => guild.id === DISCORD_GUILD_ID
        );

        if (!isMember) {
          return false; // Bloqueia o login
        }
      }
      return true;
    },
    async session({ session, token }) {
      // Adiciona o ID do Discord à sessão
      if (token.sub) {
        session.user.discordId = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});