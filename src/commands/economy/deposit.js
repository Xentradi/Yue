const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const deposit = require('../../modules/economy/bankOperations/deposit');
const {createEmbed} = require('../../utils/embedUtils');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Move virtual cash from your wallet to the bank.')
    .addIntegerOption(option =>
      option
        .setName('deposit_amount')
        .setDescription('Amount of virtual cash to deposit')
        .setRequired(true)
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction) {
    logger.info(
      `Command ${interaction.commandName} invoked by ${
        interaction.user.tag
      } with arguments ${interaction.options._hoistedOptions
        .map(option => `${option.name}: ${option.value}`)
        .join(', ')}`
    );
    await interaction.deferReply();
    const amount = interaction.options.getInteger('deposit_amount');
    const data = await deposit(
      interaction.user.id,
      interaction.guildId,
      amount
    );

    let embedOptions;

    if (data.success) {
      embedOptions = {
        title: `💰 Deposit Statement for ${interaction.member.displayName}`,
        description: `Your deposit of $${data.amount} is completed.`,
        fields: [
          {name: '💵 Cash', value: `$${data.cash.toLocaleString()}`},
          {name: '🏦 Bank', value: `$${data.bank.toLocaleString()}`},
        ],
      };
    } else {
      embedOptions = {
        title: '⚠️ Deposit Failed!',
        description: data.message,
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
