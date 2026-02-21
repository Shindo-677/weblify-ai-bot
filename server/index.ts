import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { z } from 'zod';
import { renameLuaCode } from './lua/rename.js';
import { downloadAttachmentToBuffer, safeLuaFilename } from './util/files.js';

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APP_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional().default('gpt-4o-mini'),
  MAX_FILE_BYTES: z.coerce.number().int().positive().default(500_000),
});

const env = EnvSchema.parse(process.env);

// ✅ NEW: Rate limiting map
const userCooldowns = new Map<string, number>();
const COOLDOWN_MS = 30_000; // 30 seconds

const renameCommand = new SlashCommandBuilder()
  .setName('rename')
  .setDescription('Rename Lua variables/functions for readability using AI')
  .addAttachmentOption((opt) =>
    opt
      .setName('file')
      .setDescription('Attach a .lua file')
      .setRequired(true)
  );

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = [renameCommand.toJSON()];

  if (env.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_APP_ID, env.DISCORD_GUILD_ID),
      { body }
    );
    console.log(`Registered guild slash commands for guild ${env.DISCORD_GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(env.DISCORD_APP_ID), { body });
    console.log('Registered global slash commands');
  }
}

async function handleRename(interaction: ChatInputCommandInteraction) {
  const attachment = interaction.options.getAttachment('file', true);

  // Basic validation
  const name = attachment.name ?? 'uploaded.lua';
  if (!name.toLowerCase().endsWith('.lua')) {
    await interaction.reply({
      content: 'Please attach a `.lua` file.',
      ephemeral: true,
    });
    return;
  }

  // ✅ NEW: Rate limiting check
  const userId = interaction.user.id;
  const now = Date.now();
  const cooldownExpire = userCooldowns.get(userId) ?? 0;

  if (now < cooldownExpire) {
    const remaining = Math.ceil((cooldownExpire - now) / 1000);
    await interaction.reply({
      content: `⏳ Please wait ${remaining}s before using /rename again.`,
      ephemeral: true,
    });
    return;
  }

  userCooldowns.set(userId, now + COOLDOWN_MS);

  await interaction.deferReply();

  try {
    const buf = await downloadAttachmentToBuffer(attachment.url, env.MAX_FILE_BYTES);
    const luaCode = buf.toString('utf8');

    const refactored = await renameLuaCode(luaCode, {
      openAiApiKey: env.OPENAI_API_KEY,
      openAiModel: env.OPENAI_MODEL,
    });

    const outName = safeLuaFilename(name.replace(/\.lua$/i, '_refactored.lua'));
    const file = new AttachmentBuilder(Buffer.from(refactored, 'utf8'), {
      name: outName,
    });

    await interaction.editReply({
      content: 'Refactored code:',
      files: [file],
    });
  } catch (err: any) {
    console.error('Rename error:', err);
    const msg = typeof err?.message === 'string' ? err.message : 'Unknown error';
    await interaction.editReply({
      content: `Failed to refactor file: ${msg}`,
    });
  }
}

async function main() {
  await registerCommands();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.on('ready', () => {
    console.log(`Logged in as ${client.user?.tag}`);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'rename') {
      await handleRename(interaction);
    }
  });

  await client.login(env.DISCORD_TOKEN);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});