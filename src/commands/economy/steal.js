const {SlashCommandBuilder} = require('discord.js');
const stealCash = require('../../modules/economy/tranfers/stealCash'); // Adjust the path as necessary
const {convertToSeconds} = require('../../utils/calculate');
const {createEmbed} = require('../../utils/embedUtils');

module.exports = {
  cooldown: convertToSeconds('3h'),
  data: new SlashCommandBuilder()
    .setName('steal')
    .setDescription('Attempt to steal cash from another user.')
    .addUserOption(option =>
      option
        .setName('victim')
        .setDescription('Person you want to steal from')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of cash you want to steal')
        .setRequired(true)
    ),

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

    if (!data) {
      interaction.editReply(
        "Couldn't process your request. Ensure both players exist and you're not stealing more than the target has."
      );
      return;
    }

    let embedOptions;

    if (data.successful) {
      embedOptions = {
        title: '🎉 Successful Heist!',
        description: `${
          interaction.user.username
        } managed to steal $${data.amountStolen.toLocaleString()} from ${
          victim.username
        }.`,
        color: '#33CC33',
      };
    } else {
      embedOptions = {
        title: '❌ Failed Heist!',
        description: `${interaction.user.username} failed to steal from ${
          victim.username
        } and had to pay a penalty of $${data.penalty.toLocaleString()}.`,
        color: '#FF3333',
      };
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed]});
  },
};
