import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../wolfy.js';

export const data = new SlashCommandBuilder()
  .setName('classement')
  .setDescription('Affiche le classement Wolfy (top joueurs par lauriers)')
  .addIntegerOption(opt =>
    opt.setName('top')
      .setDescription('Nombre de joueurs à afficher (défaut: 10)')
      .setMinValue(3)
      .setMaxValue(20)
  );

export async function execute(interaction) {
  const top = interaction.options.getInteger('top') ?? 10;
  await interaction.deferReply();

  const leaderboard = await getLeaderboard(top);

  if (!leaderboard || leaderboard.length === 0) {
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Classement indisponible')
        .setDescription(
          'Impossible de récupérer le classement Wolfy pour le moment.\n\n' +
          '> Wolfy ne propose pas d\'API publique de classement.\n' +
          '> Réessaie dans quelques instants ou consulte directement [wolfy.fr](https://wolfy.fr).'
        )
      ]
    });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = leaderboard.map((p, i) => {
    const medal = medals[i] ?? `**${p.rank}.**`;
    const alpha = p.isAlpha ? ' ⭐' : '';
    const lauriers = p.lauriers ? ` — **${p.lauriers.toLocaleString('fr-FR')} 🌿**` : '';
    const wins = p.wins ? ` (${p.wins} V)` : '';
    return `${medal} **${p.pseudo}**${alpha}${lauriers}${wins}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🏆 Classement Wolfy — Top joueurs')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Top ${leaderboard.length} • wolfy.fr` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
