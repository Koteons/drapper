import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayerStats } from '../wolfy.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Statistiques rapides d\'un joueur Wolfy')
  .addStringOption(opt =>
    opt.setName('pseudo')
      .setDescription('Pseudo Wolfy')
      .setRequired(true)
  );

export async function execute(interaction) {
  const pseudo = interaction.options.getString('pseudo').trim();
  await interaction.deferReply();

  const stats = await getPlayerStats(pseudo);

  if (!stats || stats.error) {
    return interaction.editReply(`❌ Joueur **${pseudo}** introuvable sur Wolfy.`);
  }

  const wr = stats.winrate ?? 0;
  const lauriersStr = stats.lauriers != null ? `${stats.lauriers.toLocaleString('fr-FR')} 🌿` : 'N/A';
  const rankStr = stats.rankPosition ? `#${stats.rankPosition}` : 'N/C';

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`📊 Stats de ${stats.pseudo}`)
    .setURL(`https://wolfy.fr/profil/${encodeURIComponent(stats.pseudo)}`)
    .setDescription([
      `🌿 **Lauriers :** ${lauriersStr}`,
      `🏆 **Classement :** ${rankStr}`,
      `🎮 **Parties :** ${stats.total} (${stats.wins}V / ${stats.losses}D)`,
      `📈 **Winrate :** ${wr}%`,
      stats.winrateInnocent != null ? `🏘️ **Innocent :** ${stats.winrateInnocent}%` : null,
      stats.winrateMenace != null ? `🐺 **Menace :** ${stats.winrateMenace}%` : null,
      stats.kills ? `🗡️ **Meurtres :** ${stats.kills}` : null,
      stats.level ? `✨ **Niveau :** ${stats.level}` : null,
      stats.favoriteRole ? `⭐ **Rôle favori :** ${stats.favoriteRole}` : null,
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'wolfy.fr • /profil pour la fiche complète' })
    .setTimestamp();

  if (stats.avatar) embed.setThumbnail(stats.avatar);

  await interaction.editReply({ embeds: [embed] });
}
