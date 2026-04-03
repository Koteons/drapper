import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPlayerStats } from '../wolfy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const LINKS_PATH = join(DATA_DIR, 'links.json');

function loadLinks() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(LINKS_PATH)) { writeFileSync(LINKS_PATH, '{}'); return {}; }
  return JSON.parse(readFileSync(LINKS_PATH, 'utf-8'));
}
function saveLinks(data) { writeFileSync(LINKS_PATH, JSON.stringify(data, null, 2)); }

export function getLinkedPseudo(discordId) {
  return loadLinks()[discordId] ?? null;
}

export const data = new SlashCommandBuilder()
  .setName('lier')
  .setDescription('Lie ton compte Discord à ton pseudo Wolfy')
  .addStringOption(opt =>
    opt.setName('pseudo')
      .setDescription('Ton pseudo sur wolfy.fr')
      .setRequired(true)
  );

export async function execute(interaction) {
  const pseudo = interaction.options.getString('pseudo').trim();
  await interaction.deferReply({ ephemeral: true });

  // Vérifie que le pseudo existe sur Wolfy
  const stats = await getPlayerStats(pseudo);
  if (!stats || stats.error) {
    return interaction.editReply(`❌ Pseudo **${pseudo}** introuvable sur Wolfy. Vérifie l'orthographe.`);
  }

  const links = loadLinks();
  links[interaction.user.id] = stats.pseudo; // utilise le pseudo normalisé
  saveLinks(links);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('✅ Compte lié !')
    .setDescription(
      `Ton Discord est maintenant lié à **${stats.pseudo}** sur Wolfy.\n\n` +
      `Tu peux maintenant utiliser \`/stats\` et \`/profil\` sans préciser de pseudo.`
    )
    .setFooter({ text: 'Pour changer, relance /lier avec un autre pseudo.' });

  await interaction.editReply({ embeds: [embed] });
}
