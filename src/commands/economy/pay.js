const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const giveCash = require('../../modules/economy/tranfers/giveCash');
const {createEmbed} = require('../../utils/embedUtils');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Transfer virtual cash to another member.')
    .addUserOption(option =>
      option
        .setName('target_user')
        .setDescription('Person to receive the cash')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('cash_amount')
        .setDescription('The amount of virtual cash you wish to send')
        .setRequired(true)
    ),
  cooldown: 2,
  deployGlobal: true,

  /**
   * Executes the pay command, allowing users to transfer cash to others.
   *
   * @async
   * @function
   * @param {BaseInteraction} interaction - The interaction that triggered the command.
   * @throws Will send an error response to the user if there's an issue processing the transaction.
   */
  async execute(interaction) {
    logger.info(
      `Command ${interaction.commandName} invoked by ${
        interaction.user.tag
      } with arguments ${interaction.options._hoistedOptions
        .map(option => `${option.name}: ${option.value}`)
        .join(', ')}`
    );
    await interaction.deferReply();

    const recipient = interaction.options.getUser('target_user');
    const amount = interaction.options.getInteger('cash_amount');
    const data = await giveCash(
      interaction.user.id,
      recipient.id,
      interaction.guildId,
      amount
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
    interaction.editReply({embeds: [responseEmbed]});
  },
};
