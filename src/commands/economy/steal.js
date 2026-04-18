const { SlashCommandBuilder } = require('discord.js');
const stealCash = require('../../modules/economy/transfers/stealCash');
const {
  createStatusEmbed,
  createBalanceEmbed,
  getDisplayName,
  formatCurrency,
} = require('../../utils/economyFeedback');
const { deferGuildInteraction } = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('steal')
    .setDescription('Attempt to steal cash from another member.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member you want to rob')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Amount to attempt to steal')
        .setRequired(true),
    ),
  cooldown: '1h',
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Steals can only be attempted inside a server.',
      }))
    ) {
      return;
    }

    const victim = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const victimName = getDisplayName(interaction, victim);
    const thiefName = interaction.member.displayName;

    const endUpdate = commandMetrics?.step('steal attempt');
    const data = await stealCash(
      interaction.user.id,
      victim.id,
      interaction.guildId,
      amount,
    );
    endUpdate?.();

    if (!data) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: 'Heist Error',
        description:
          "Your heist didn't go as planned. Maybe the target couldn't be found?",
        color: '#FF8C00',
      });
      endRender?.();
      return interaction.reply({ embeds: [responseEmbed] });
    }

    if (
      data.successful === false &&
      data.amountStolen === 0 &&
      data.penalty === 0
    ) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: 'Heist Error',
        description:
          data.message ?? 'The steal attempt could not be processed.',
        color: '#FF8C00',
      });
      endRender?.();
      return interaction.reply({ embeds: [responseEmbed] });
    }

    const victoryMessage = [
      'Smooth moves, master thief!',
      "You're a natural! The heist went perfectly.",
      'Silent and deadly, they never saw it coming!',
      'Looks like crime does pay... this time!',
    ];

    const defeatMessage = [
      'Busted! They caught you in the act.',
      'Oops! Looks like you tripped the alarms.',
      'You might want to rethink your life choices...',
      "Jail's not fun, is it? Better luck next time!",
    ];

    const randomMessage = data.successful
      ? victoryMessage[Math.floor(Math.random() * victoryMessage.length)]
      : defeatMessage[Math.floor(Math.random() * defeatMessage.length)];

    if (data.successful) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createBalanceEmbed({
        title: 'Heist Report: Success!',
        description: `${randomMessage}\n${thiefName} managed to swipe ${formatCurrency(data.amountStolen)} from ${victimName}.`,
        cash: data.playerCash,
        bank: data.playerBank,
        debt: data.playerDebt,
        color: '#33CC33',
      });
      endRender?.();
      return interaction.reply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title: 'Heist Report: Busted!',
      description: `${randomMessage}\n${thiefName} was caught trying to steal from ${victimName} and faced a fine of ${formatCurrency(data.penalty)}.`,
      color: '#FF3333',
    });
    endRender?.();
    return interaction.reply({ embeds: [responseEmbed] });
  },
};
