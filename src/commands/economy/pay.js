const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const {giveCash} = require('../../modules/economy/tranfers/giveCash');
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  cooldown: convertToSeconds('1s'),
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Send cash to another user.')
    .addUserOption(option =>
      option
        .setName('recipient')
        .setDescription('Person to receive the cash')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of cash to send')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const recipient = interaction.options.getUser('recipient');
    const amount = interaction.options.getInteger('amount');
    const data = await giveCash(
      interaction.user.id,
      recipient.id,
      interaction.guildId,
      amount
    );

    const embedOptions = {
      title: '💸 Transfer Details',
      description: `${
        interaction.user.username
      } has sent $${data.transferredAmount.toLocaleString()} to ${
        recipient.username
      }.`,
    };
    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
