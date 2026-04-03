import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayerStats } from './wolfy.js';

export const data = new SlashCommandBuilder()
  .setName('comparer')
  .setDescription('Compare les stats de deux joueurs Wolfy')
  .addStringOption(opt =>
    opt.setName('joueur1').setDescription('Premier pseudo Wolfy').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('joueur2').setDescription('Deuxième pseudo Wolfy').setRequired(true)
  );

export async function execute(interaction) {
  const p1name = interaction.options.getString('joueur1').trim();
  const p2name = interaction.options.getString('joueur2').trim();
  await interaction.deferReply();

  const [p1, p2] = await Promise.all([getPlayerStats(p1name), getPlayerStats(p2name)]);

  const erreurs = [];
  if (!p1 || p1.error) erreurs.push(p1name);
  if (!p2 || p2.error) erreurs.push(p2name);

  if (erreurs.length > 0) {
    return interaction.editReply(`❌ Joueur(s) introuvable(s) : **${erreurs.join(', ')}**`);
  }

  // ─── Comparateur ──────────────────────────────────────────────────────────
  const win = (a, b, higher = true) => {
    if (a == null || b == null) return ['➖', '➖'];
    if (higher ? a > b : a < b) return ['✅', '❌'];
    if (a === b) return ['🟰', '🟰'];
    return ['❌', '✅'];
  };

  const [w1, w2] = win(p1.winrate, p2.winrate);
  const [l1, l2] = win(p1.lauriers, p2.lauriers);
  const [t1, t2] = win(p1.total, p2.total);
  const [k1, k2] = win(p1.kills, p2.kills);

  const row = (label, v1, v2, icons) =>
    `**${label}**\n${icons[0]} ${v1 ?? 'N/A'} vs ${v2 ?? 'N/A'} ${icons[1]}`;

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`⚔️ ${p1.pseudo} vs ${p2.pseudo}`)
    .addFields(
      {
        name: `🟦 ${p1.pseudo}${p1.isAlpha ? ' ⭐' : ''}`,
        value: [
          p1.lauriers != null ? `🌿 ${p1.lauriers.toLocaleString('fr-FR')} lauriers` : null,
          p1.total ? `🎮 ${p1.total} parties` : null,
          p1.winrate != null ? `📈 ${p1.winrate}% WR` : null,
          p1.kills ? `🗡️ ${p1.kills} meurtres` : null,
          p1.winrateInnocent != null ? `🏘️ Innocent: ${p1.winrateInnocent}%` : null,
          p1.winrateMenace != null ? `🐺 Loup: ${p1.winrateMenace}%` : null,
          p1.level ? `✨ Niv. ${p1.level}` : null,
        ].filter(Boolean).join('\n') || 'Données limitées',
        inline: true,
      },
      {
        name: `🟥 ${p2.pseudo}${p2.isAlpha ? ' ⭐' : ''}`,
        value: [
          p2.lauriers != null ? `🌿 ${p2.lauriers.toLocaleString('fr-FR')} lauriers` : null,
          p2.total ? `🎮 ${p2.total} parties` : null,
          p2.winrate != null ? `📈 ${p2.winrate}% WR` : null,
          p2.kills ? `🗡️ ${p2.kills} meurtres` : null,
          p2.winrateInnocent != null ? `🏘️ Innocent: ${p2.winrateInnocent}%` : null,
          p2.winrateMenace != null ? `🐺 Loup: ${p2.winrateMenace}%` : null,
          p2.level ? `✨ Niv. ${p2.level}` : null,
        ].filter(Boolean).join('\n') || 'Données limitées',
        inline: true,
      },
      {
        name: '📊 Avantage',
        value: [
          p1.winrate != null && p2.winrate != null
            ? `Winrate : ${w1} ${p1.pseudo} — ${p2.pseudo} ${w2}` : null,
          p1.lauriers != null && p2.lauriers != null
            ? `Lauriers : ${l1} ${p1.pseudo} — ${p2.pseudo} ${l2}` : null,
          p1.total && p2.total
            ? `Expérience : ${t1} ${p1.pseudo} — ${p2.pseudo} ${t2}` : null,
          p1.kills && p2.kills
            ? `Meurtres : ${k1} ${p1.pseudo} — ${p2.pseudo} ${k2}` : null,
        ].filter(Boolean).join('\n') || 'Impossible de comparer',
        inline: false,
      }
    )
    .setFooter({ text: 'wolfy.fr' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
