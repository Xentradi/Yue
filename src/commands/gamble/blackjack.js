const { SlashCommandBuilder } = require('discord.js');
const playBlackjack = require('../../modules/games/blackjackGame');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack for cash.')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('The amount you wish to wager')
        .setRequired(true),
    ),
  cooldown: 3,
  deployGlobal: true,

  execute: playBlackjack,
};
