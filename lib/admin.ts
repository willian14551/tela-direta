const DISCORD_ID_PATTERN = /^\d{16,22}$/;

/**
 * Lê uma lista separada por vírgulas, espaços ou quebras de linha. IDs
 * inválidos são ignorados e a ausência da variável mantém o painel fechado.
 */
export function getAdminDiscordIds(): Set<string> {
  const configuredIds = process.env.ADMIN_DISCORD_IDS ?? "";

  return new Set(
    configuredIds
      .split(/[\s,;]+/)
      .map((id) => id.trim())
      .filter((id) => DISCORD_ID_PATTERN.test(id)),
  );
}

export function isAdminDiscordId(
  discordId: string | null | undefined,
): boolean {
  return Boolean(discordId && getAdminDiscordIds().has(discordId));
}
