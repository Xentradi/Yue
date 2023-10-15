const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const withdraw = require('../../modules/economy/bankOperations/withdraw');
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  cooldown: convertToSeconds('1s'),
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw cash from your bank.')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount to withdraw')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const amount = interaction.options.getInteger('amount');
    const data = await withdraw(
      interaction.user.id,
      interaction.guildId,
      amount
    );
    let embedOptions = {};

    if (data === null) {
      embedOptions = {
        title: '💰 Withdrawal Statement',
        description: 'Account not found.',
        color: '#FF3333',
      };
    } else if (data === false) {
      embedOptions = {
        title: '💰 Withdrawal Statement',
        description: 'Invalid withdrawal amount.',
        color: '#FF3333',
      };
    } else if (!data.success) {
      embedOptions = {
        title: '💰 Withdrawal Statement',
        description: data.message,
        color: '#FF3333',
      };
    } else {
      embedOptions = {
        title: `💰 Withdrawal Statement for ${interaction.user.username}`,
        description: `Your withdrawal of $${data.amount.toLocaleString()} is completed.`,
        color: '#33CC33',
        fields: [
          {name: '💵 Cash', value: `$${data.cash.toLocaleString()}`},
          {name: '🏦 Bank', value: `$${data.bank.toLocaleString()}`},
        ],
        footer: {text: 'Yue Bank Corp.'},
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
