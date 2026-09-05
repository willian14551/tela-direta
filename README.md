# Tela Direta

Aplicação Next.js para criar salas privadas de compartilhamento de tela com
LiveKit. O acesso ao site é permitido somente para contas que pertencem a um
servidor específico do Discord.

## O que roda onde

- **Vercel:** site Next.js, login do Discord, criação dos convites e emissão de
  tokens do LiveKit.
- **LiveKit Cloud:** áudio, vídeo e compartilhamento de tela em tempo real.
- **Hospedagem com processo contínuo:** bot da pasta `discord-bot`.

O bot atual usa o Gateway do Discord e mantém uma conexão contínua com
`client.login()`. Ele não deve ser hospedado como uma Function da Vercel. Use
um serviço que mantenha um processo Node ativo, como Render, Railway, Fly.io ou
uma VPS. O site continua funcionando na Vercel mesmo sem o bot.

## 1. Configurar o aplicativo no Discord

1. Abra o [Discord Developer Portal](https://discord.com/developers/applications)
   e selecione a aplicação usada pelo projeto.
2. Em **OAuth2 > Redirects**, cadastre exatamente:
   - desenvolvimento: `http://localhost:3000/api/auth/callback/discord`
   - produção: `https://SEU-DOMINIO.vercel.app/api/auth/callback/discord`
3. Copie o **Application ID** e o **Client Secret** da aplicação.
4. No Discord, ative o modo desenvolvedor, clique com o botão direito no
   servidor permitido e use **Copiar ID do servidor**.

Não use a URL temporária de cada preview como redirect do Discord. Para o fluxo
mais simples, teste o OAuth no domínio estável de produção da Vercel.

## 2. Variáveis do site

Copie `.env.example` para `.env.local` no desenvolvimento. Na Vercel, adicione
as mesmas chaves em **Project > Settings > Environment Variables**:

| Variável                | Obrigatória | Conteúdo                                                   |
| ----------------------- | ----------- | ---------------------------------------------------------- |
| `AUTH_SECRET`           | Sim         | Segredo aleatório com pelo menos 32 caracteres             |
| `AUTH_DISCORD_ID`       | Sim         | Application ID do Discord                                  |
| `AUTH_DISCORD_SECRET`   | Sim         | Client Secret do Discord                                   |
| `DISCORD_GUILD_ID`      | Sim         | ID numérico do servidor permitido                          |
| `ADMIN_DISCORD_IDS`     | Só painel   | IDs Discord autorizados no `/admin`, separados por vírgula |
| `LIVEKIT_URL`           | Sim         | URL `wss://...` do projeto LiveKit                         |
| `LIVEKIT_API_KEY`       | Sim         | API Key do LiveKit                                         |
| `LIVEKIT_API_SECRET`    | Sim         | API Secret do LiveKit                                      |
| `ROOM_SIGNING_SECRET`   | Não         | Chave separada para convites; usa `AUTH_SECRET` se ausente |
| `TELADIRETA_BOT_SECRET` | Só com bot  | Mesmo segredo configurado no processo do bot               |

Gere `AUTH_SECRET` com:

```bash
npm exec auth secret
```

Depois de criar ou alterar variáveis na Vercel, faça um novo deployment. Nunca
adicione segredos a variáveis com prefixo `NEXT_PUBLIC_`.

Para obter seu ID, ative o **Modo desenvolvedor** no Discord, clique com o
botão direito no seu próprio perfil e selecione **Copiar ID do usuário**. Um
exemplo com dois administradores seria:

```env
ADMIN_DISCORD_IDS=123456789012345678,987654321098765432
```

## 3. Executar o site localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. O login solicita os escopos `identify` e
`guilds`. Depois do OAuth, o servidor consulta a API do Discord com o access
token e confirma se `DISCORD_GUILD_ID` está entre os servidores daquela conta.

## 4. Publicar o site na Vercel

Ao importar o repositório, deixe **Root Directory** na raiz do projeto, onde
fica o `package.json` principal. Não selecione a pasta `discord-bot`.

Confira antes do deploy:

- o redirect cadastrado no Discord é idêntico ao domínio de produção;
- `AUTH_DISCORD_ID` e `AUTH_DISCORD_SECRET` pertencem à mesma aplicação;
- `DISCORD_GUILD_ID` é o ID do servidor, não o ID de um canal;
- todas as variáveis obrigatórias estão habilitadas para **Production**;
- o bot e o site usam o mesmo `TELADIRETA_BOT_SECRET`, quando aplicável.

## 5. Executar o bot

Na hospedagem escolhida para processos contínuos:

```bash
cd discord-bot
npm install
npm start
```

Use `discord-bot/.env.example` como referência. `TELADIRETA_URL` deve apontar
para o domínio de produção do site, e `TELADIRETA_BOT_SECRET` deve ser uma
string aleatória de pelo menos 32 caracteres.

## Segurança dos convites

O convite tem o formato `/room/ID#s=SEGREDO`. O fragmento depois de `#` não é
enviado automaticamente em requisições HTTP nem em cabeçalhos de referência.
Durante o OAuth ele fica apenas no `sessionStorage` da aba. Para entrar, o
navegador o envia explicitamente por HTTPS ao endpoint de token.

O segredo contém expiração e nonce assinados com HMAC. Isso permite validar o
mesmo convite em qualquer instância serverless da Vercel sem guardar salas em
memória. Os convites expiram depois de 24 horas.

## Ciclo de vida das salas

A sala de mídia do LiveKit só é criada quando o primeiro participante entra e,
por padrão, é encerrada 20 segundos depois que o último sai. Esse pequeno prazo
permite uma reconexão sem manter áudio, vídeo ou uso contínuo de banda quando a
sala está vazia.

O convite continua válido por 24 horas. Se alguém usá-lo novamente depois do
encerramento, o LiveKit cria uma nova sala vazia com o mesmo identificador; a
sala anterior não permanece rodando.

## Painel administrativo

Administradores configurados em `ADMIN_DISCORD_IDS` podem abrir `/admin` para
acompanhar as salas ativas, quem está conectado e quais mídias cada pessoa está
publicando. A consulta ocorre somente no servidor e é atualizada a cada cinco
segundos enquanto o painel estiver aberto; a chave secreta do LiveKit nunca é
enviada ao navegador.

O painel mostra a identidade autenticada pelo Discord separadamente do nome que
a pessoa escolheu para usar na sala. Participantes conectados antes desta versão
podem não exibir nome e avatar verificados até entrarem novamente.

## Controles da transmissão

- O menu **Áudio** controla separadamente a voz e o compartilhamento de cada
  participante. Todas as trilhas começam em 100%.
- O menu **Qualidade** permite transmitir em 480p, 720p ou 1080p, com 15 ou 30
  FPS. O padrão é 1080p a 30 FPS.
- **Tela cheia** mostra somente a transmissão ativa. Os controles desaparecem
  após alguns segundos sem movimento e reaparecem ao mover o mouse ou tocar na
  tela.
- Ao compartilhar a tela inteira, o usuário pode enviar todo o áudio do
  computador. Ao escolher uma janela no Brave atual, Chrome ou Edge 141+, o
  app solicita `windowAudio: "window"` para capturar somente o som dela. Em
  navegadores que não garantem esse isolamento, o áudio de janelas é removido
  antes de chegar ao LiveKit; abas ainda compartilham apenas o próprio áudio.

## Erros comuns

- **`NextAuth is not callable`:** havia um arquivo `next-auth.d.ts` na raiz
  sombreando o pacote. As declarações agora ficam em `types/next-auth.d.ts`.
- **`OAuthSignin` / `OAuthCallbackError`:** Client ID, Client Secret ou redirect
  do Discord não correspondem ao deployment aberto.
- **`AccessDenied`:** a conta não pertence ao servidor configurado ou o
  `DISCORD_GUILD_ID` está errado.
- **`DiscordVerificationFailed`:** o Discord não devolveu o escopo `guilds`, a
  API do Discord falhou ou a configuração do servidor está ausente.
- **`MissingSecret`:** `AUTH_SECRET` não foi configurado na Vercel.
- **`Link inválido ou expirado`:** convite expirado, assinatura alterada ou
  `ROOM_SIGNING_SECRET`/`AUTH_SECRET` foi trocado depois da criação do link.
- **O Windows abaixa o som compartilhado durante a chamada:** abra
  **Configurações > Sistema > Som > Mais configurações de som > Comunicações**,
  marque **Não fazer nada** e aplique. Esse ajuste é do sistema operacional e
  não pode ser sobrescrito pelo navegador. Usar fones também evita que a voz da
  chamada volte para a transmissão como eco.
