import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import "dotenv/config";

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "TELADIRETA_URL",
  "TELADIRETA_BOT_SECRET",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Falta a variável de ambiente: ${envVar}`);
    process.exit(1);
  }
}

const command = new SlashCommandBuilder()
  .setName("criar_sala_de_tela")
  .setDescription("Cria uma sala do Tela Direta com link privado")
  .addStringOption((option) =>
    option
      .setName("assunto")
      .setDescription("Assunto da sala, opcional")
      .setMaxLength(80)
  );

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(
    process.env.DISCORD_CLIENT_ID,
    process.env.DISCORD_GUILD_ID
  ),
  {
    body: [command.toJSON()],
  }
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot online como ${readyClient.user.tag}`);
  console.log(`Comando registrado somente no guild: ${process.env.DISCORD_GUILD_ID}`);
});

function hasAllowedRole(interaction) {
  const allowedRoleId = process.env.ALLOWED_ROLE_ID;

  if (!allowedRoleId) {
    return true;
  }

  const member = interaction.member;

  if (!member) {
    return false;
  }

  // Quando o member vem como objeto da API do Discord
  if (Array.isArray(member.roles)) {
    return member.roles.includes(allowedRoleId);
  }

  // Quando o member é um GuildMember cacheado
  if (member.roles?.cache?.has?.(allowedRoleId)) {
    return true;
  }

  return false;
}

async function createRoomViaApi() {
  const baseUrl = process.env.TELADIRETA_URL.replace(/\/$/, "");
  const apiUrl = `${baseUrl}/api/rooms/bot`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.TELADIRETA_BOT_SECRET}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao criar sala. HTTP ${response.status}. ${text}`);
  }

  return response.json();
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Este comando só pode ser usado dentro do servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.guildId !== process.env.DISCORD_GUILD_ID) {
    await interaction.reply({
      content: "Este bot está vinculado a outro servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.commandName !== command.name) return;

  if (!hasAllowedRole(interaction)) {
    await interaction.reply({
      content: "Você não tem permissão para criar salas.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    const { roomId, secret } = await createRoomViaApi();

    const baseUrl = process.env.TELADIRETA_URL.replace(/\/$/, "");
    const inviteLink = `${baseUrl}/room/${roomId}#s=${secret}`;

    const subject = interaction.options.getString("assunto");

    const lines = [];

    if (subject) {
      lines.push(`Sala criada: **${subject}**`);
    } else {
      lines.push("Sala criada.");
    }

    lines.push(`Link: <${inviteLink}>`);
    lines.push("");
    lines.push(
      "O trecho depois de `#` é o segredo. Envie o link completo para quem pode entrar."
    );

    await interaction.editReply(lines.join("\n"));
  } catch (error) {
    console.error(error);

    await interaction.editReply(
      "Não foi possível criar a sala agora. Tente novamente em instantes."
    );
  }
});

client.login(process.env.DISCORD_TOKEN);