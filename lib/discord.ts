type DiscordGuild = {
  id?: unknown;
};

const DISCORD_GUILDS_URL =
  "https://discord.com/api/v10/users/@me/guilds?limit=200";

/**
 * Consulta os servidores da conta que acabou de autorizar o aplicativo.
 *
 * O endpoint de perfil do Discord (/users/@me) não devolve os servidores do
 * usuário. Mesmo pedindo o escopo `guilds`, essa lista precisa ser consultada
 * separadamente com o access token recebido no OAuth.
 */
export async function isDiscordGuildMember(
  accessToken: string,
  guildId: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!accessToken) {
    throw new Error("O Discord não devolveu um access token.");
  }

  if (!/^\d{16,22}$/.test(guildId)) {
    throw new Error("DISCORD_GUILD_ID não contém um ID válido.");
  }

  const response = await fetcher(DISCORD_GUILDS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(
      `O Discord recusou a consulta dos servidores (HTTP ${response.status}).`,
    );
  }

  const guilds: unknown = await response.json();

  if (!Array.isArray(guilds)) {
    throw new Error("O Discord devolveu uma resposta inesperada.");
  }

  return guilds.some(
    (guild: DiscordGuild) =>
      typeof guild === "object" && guild !== null && guild.id === guildId,
  );
}
