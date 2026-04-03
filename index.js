import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'ton_token_ici') {
  console.error('\n❌ DISCORD_TOKEN manquant !\nCopie .env.example en .env et remplis-le.\n');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const cmdFiles = ['profil.js', 'stats.js', 'classement.js', 'comparer.js', 'lier.js'];
for (const file of cmdFiles) {
  const cmd = await import(pathToFileURL(join(__dirname, file)).href);
  if ('data' in cmd && 'execute' in cmd) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`✅ /${cmd.data.name}`);
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const route = process.env.GUILD_ID
  ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
  : Routes.applicationCommands(process.env.CLIENT_ID);

try {
  console.log('\n🔄 Déploiement des slash commands...');
  await rest.put(route, { body: [...client.commands.values()].map(c => c.data.toJSON()) });
  console.log('✅ Commandes déployées !\n');
} catch (err) {
  console.error('❌ Erreur déploiement :', err.message);
}

client.once('ready', () => {
  console.log(`🐺 ${client.user.tag} connecté !`);
  client.user.setActivity('🐺 Stats Wolfy • /profil', { type: 4 });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Erreur /${interaction.commandName} :`, err.message);
    const msg = { content: '❌ Une erreur est survenue. Réessaie dans un instant.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
