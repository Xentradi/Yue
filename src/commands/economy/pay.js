const { SlashCommandBuilder } = require('discord.js');
const giveCash = require('../../modules/economy/tranfers/giveCash');
const { createEmbed } = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Transfer virtual cash to another member.')
    .addUserOption((option) =>
      option
        .setName('target_user')
        .setDescription('Person to receive the cash')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('cash_amount')
        .setDescription('The amount of virtual cash you wish to send')
        .setRequired(true),
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply();

    const recipient = interaction.options.getUser('target_user');
    const amount = interaction.options.getInteger('cash_amount');
    const data = await giveCash(
      interaction.user.id,
      recipient.id,
      interaction.guildId,
      amount,
    );

    let embedOptions;

    if (data.success) {
      embedOptions = {
        title: '💸 Transfer Details',
        description: `${
          interaction.member.displayName
        } has sent $${data.transferredAmount.toLocaleString()} to ${
          recipient.displayName
        }.`,
      };
    } else {
      embedOptions = {
        title: '❌ Transaction Failed',
        description: data.message,
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({ embeds: [responseEmbed] });
  },
};
