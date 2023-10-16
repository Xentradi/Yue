const {SlashCommandBuilder} = require('discord.js');
const stealCash = require('../../modules/economy/tranfers/stealCash');
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('steal')
    .setDescription(
      'Embark on a daring heist to snatch cash from a fellow member.'
    )
    .addUserOption(option =>
      option
        .setName('victim')
        .setDescription('The unsuspecting member you aim to rob')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The pile of cash you have your eyes set on')
        .setRequired(true)
    ),
  cooldown: convertToSeconds('3h'),
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply();

    const victim = interaction.options.getUser('victim');
    const amount = interaction.options.getInteger('amount');

    const data = await stealCash(
      interaction.user.id,
      victim.id,
      interaction.guildId,
      amount
    );

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

    if (!data) {
      const embedOptions = {
        title: 'Heist Error',
        description:
          "Your heist didn't go as planned. Maybe the treasure chest was empty?",
        color: '#FF8C00', // Suggesting an orange for error
      };
      const responseEmbed = createEmbed(embedOptions);
      interaction.editReply({embeds: [responseEmbed]});
      return;
    }

    let embedOptions;

    if (data.successful) {
      embedOptions = {
        title: 'Heist Report: Success!',
        description: `${randomMessage}\n${
          interaction.user.username
        } managed to swipe $${data.amountStolen.toLocaleString()} from ${
          victim.username
        }.`,
        color: '#33CC33',
      };
    } else {
      embedOptions = {
        title: 'Heist Report: Busted!',
        description: `${randomMessage}\n${
          interaction.user.username
        } was caught trying to steal from ${
          victim.username
        } and faced a fine of $${data.penalty.toLocaleString()}.`,
        color: '#FF3333',
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
