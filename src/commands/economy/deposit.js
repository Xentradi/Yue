const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const deposit = require('../../modules/economy/bankOperations/deposit');
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  cooldown: convertToSeconds('1s'),
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Move virtual cash from your wallet to the bank.')
    .addIntegerOption(option =>
      option
        .setName('deposit_amount')
        .setDescription('Amount of virtual cash to deposit')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const amount = interaction.options.getInteger('deposit_amount');
    const data = await deposit(
      interaction.user.id,
      interaction.guildId,
      amount
    );

    const embedOptions = {
      title: `💰 Deposit Statement for ${interaction.user.displayName}`,
      description: `Your deposit of $${data.amount} is completed.`,
      fields: [
        {name: '💵 Cash', value: `$${data.cash.toLocaleString()}`},
        {name: '🏦 Bank', value: `$${data.bank.toLocaleString()}`},
      ],
    };
    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
