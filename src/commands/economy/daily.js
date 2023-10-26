const {SlashCommandBuilder, BaseInteraction} = require('discord.js');
const dailyBonus = require('../../modules/economy/bonuses/dailyBonus');
const {createEmbed} = require('../../utils/embedUtils');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward.'),
  cooldown: '1s',
  deployGlobal: true,

  /**
   * @param {BaseInteraction} interaction
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
    const data = await dailyBonus(interaction.user.id, interaction.guildId);
    data.username = interaction.member.displayName;
    let embedOptions = {};

    if (data.success) {
      embedOptions = {
        title: `💰 ${data.username} Pay Stub`,
        description: `Your daily pay of $${data.amount} has been delivered.`,
      };
    } else if (
      !data.success &&
      data.message === 'Daily bonus already claimed today.'
    ) {
      embedOptions = {
        title: `⚠️ ${data.username} Pay Already Delivered`,
        description: 'Your daily pay has already been delivered.',
      };
    } else {
      embedOptions = {
        title: '‼️ Daily Pay Error',
        description: 'There was an error delivering your pay.',
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
