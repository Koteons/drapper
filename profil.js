import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayerStats } from './wolfy.js';

export const data = new SlashCommandBuilder()
  .setName('profil')
  .setDescription('Affiche le profil et les stats Wolfy d\'un joueur')
  .addStringOption(opt =>
    opt.setName('pseudo')
      .setDescription('Pseudo Wolfy du joueur')
      .setRequired(true)
  );

export async function execute(interaction) {
  const pseudo = interaction.options.getString('pseudo').trim();
  await interaction.deferReply();

  const stats = await getPlayerStats(pseudo);

  if (!stats) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Joueur introuvable')
        .setDescription(
          `Le joueur **${pseudo}** est introuvable sur Wolfy.\n\n` +
          `Vérifie que le pseudo est exact (sensible à la casse) et que le profil est public.`
        )
      ]
    });
  }

  if (stats.error === 'not_found') {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Profil introuvable')
        .setDescription(`Aucun compte Wolfy trouvé pour **${pseudo}**.`)
      ]
    });
  }

  // ─── Tier par lauriers ────────────────────────────────────────────────────
  const tier = getTier(stats.lauriers);

  // ─── Winrate bar ──────────────────────────────────────────────────────────
  const wr = stats.winrate ?? 0;
  const barLen = 18;
  const filled = Math.round((wr / 100) * barLen);
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

  // ─── Champs conditionnels ─────────────────────────────────────────────────
  const fields = [];

  // Lauriers
  if (stats.lauriers !== null && stats.lauriers !== undefined) {
    fields.push({
      name: '🌿 Lauriers totaux',
      value: `**${stats.lauriers.toLocaleString('fr-FR')}** ${tier.emoji} ${tier.name}`,
      inline: true,
    });
  }
  if (stats.lauriersSaison !== null && stats.lauriersSaison !== undefined) {
    fields.push({
      name: '🌙 Lauriers saison',
      value: `**${stats.lauriersSaison.toLocaleString('fr-FR')}**`,
      inline: true,
    });
  }
  if (stats.rankPosition) {
    fields.push({
      name: '🏆 Classement',
      value: `**#${stats.rankPosition}**`,
      inline: true,
    });
  }

  // Stats de parties
  if (stats.total > 0) {
    fields.push({
      name: '📊 Parties jouées',
      value: `**${stats.total}** (${stats.wins}V / ${stats.losses}D)`,
      inline: true,
    });
    fields.push({
      name: `📈 Winrate — ${wr}%`,
      value: `\`${bar}\``,
      inline: false,
    });
  }

  // Camps
  if (stats.winrateInnocent !== null && stats.winrateInnocent !== undefined) {
    fields.push({
      name: '🏘️ Villageois (Innocent)',
      value: `**${stats.winrateInnocent}%** de victoires`,
      inline: true,
    });
  }
  if (stats.winrateMenace !== null && stats.winrateMenace !== undefined) {
    fields.push({
      name: '🐺 Loup / Solitaire (Menace)',
      value: `**${stats.winrateMenace}%** de victoires`,
      inline: true,
    });
  }

  // Autres stats
  if (stats.kills > 0) {
    fields.push({ name: '🗡️ Meurtres', value: `**${stats.kills}**`, inline: true });
  }
  if (stats.avgWordsPerGame) {
    fields.push({ name: '💬 Mots / partie', value: `**${stats.avgWordsPerGame}**`, inline: true });
  }
  if (stats.favoriteRole) {
    fields.push({ name: '⭐ Rôle favori', value: `**${stats.favoriteRole}**`, inline: true });
  }
  if (stats.level) {
    fields.push({ name: '✨ Niveau', value: `**${stats.level}**`, inline: true });
  }

  // Historique des dernières parties
  if (stats.history?.length > 0) {
    const histStr = stats.history.map(h => {
      const emoji = h.won || h.win || h.victory ? '✅' : '❌';
      const role = h.role ? ` — ${h.role}` : '';
      const players = h.players ? ` (${h.players} joueurs)` : '';
      const type = h.serious || h.ranked ? ' 🎯' : '';
      return `${emoji}${role}${players}${type}`;
    }).join('\n');
    fields.push({ name: '📜 Dernières parties', value: histStr, inline: false });
  }

  // ─── Embed final ─────────────────────────────────────────────────────────
  const gradeLabel = [
    stats.isAlpha ? '⭐ Alpha' : null,
    stats.grade ?? null,
  ].filter(Boolean).join(' · ') || null;

  const embed = new EmbedBuilder()
    .setColor(tier.color)
    .setTitle(`🐺 ${stats.pseudo}${gradeLabel ? ` — ${gradeLabel}` : ''}`)
    .setURL(`https://wolfy.fr/profil/${encodeURIComponent(stats.pseudo)}`)
    .setFields(fields)
    .setFooter({
      text: [
        'wolfy.fr',
        stats.createdAt ? `Inscrit le ${new Date(stats.createdAt).toLocaleDateString('fr-FR')}` : null,
        stats._source === 'html' ? '⚠️ Données partielles (profil HTML)' : null,
      ].filter(Boolean).join(' · ')
    })
    .setTimestamp();

  if (stats.avatar) embed.setThumbnail(stats.avatar);

  await interaction.editReply({ embeds: [embed] });
}

function getTier(lauriers) {
  if (lauriers === null || lauriers === undefined)
    return { name: '—', emoji: '🐺', color: 0x7f8c8d };
  if (lauriers >= 5000) return { name: 'Lauriers d\'Or',      emoji: '🥇', color: 0xf1c40f };
  if (lauriers >= 2000) return { name: 'Lauriers d\'Argent',  emoji: '🥈', color: 0xbdc3c7 };
  if (lauriers >= 1000) return { name: 'Lauriers de Bronze',  emoji: '🥉', color: 0xe67e22 };
  if (lauriers >= 500)  return { name: 'Lauriers d\'Acier',   emoji: '⚙️', color: 0x3498db };
  return                       { name: 'Joueur actif',        emoji: '🌿', color: 0x2ecc71 };
}
