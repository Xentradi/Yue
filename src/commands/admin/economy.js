const {SlashCommandBuilder} = require('discord.js');
const {createEmbed} = require('../../utils/embedUtils');
const economyHandler = require('../../modules/economy/adminOperations/economyHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy administrator operations')
    .addSubcommand(subcommand =>
      subcommand
        .setName('checkbalances')
        .setDescription("Check a user's balances")
        .addUserOption(option =>
          option.setName('user').setDescription('The user').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the cash, bank, or debt of a user')
        .addUserOption(option =>
          option.setName('user').setDescription('The user').setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('field')
            .setDescription('Field to set (cash, bank, debt)')
            .setRequired(true)
            .addChoices(
              {name: 'cash', value: 'casch'},
              {name: 'bank', value: 'bank'},
              {name: 'debt', value: 'debt'}
            )
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount to set')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('give')
        .setDescription('Give cash, bank, or decrease debt of a user')
        .addUserOption(option =>
          option.setName('user').setDescription('The user').setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('field')
            .setDescription('Field to set (cash, bank, debt)')
            .setRequired(true)
            .addChoices(
              {name: 'cash', value: 'casch'},
              {name: 'bank', value: 'bank'},
              {name: 'debt', value: 'debt'}
            )
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount to give')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription("Reset all of a user's economy values to 0")
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to reset')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('airdrop')
        .setDescription(
          'Give everyone active in the channel an entered amount of cash'
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount to airdrop to each active user')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ephemeral: true});

    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      const responseEmbed = createEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({embeds: [responseEmbed], ephemeral: true});
    }

    const response = economyHandler(interaction);

    const embedOptions = {
      title: `💰 Financial Statement for ${response.user.displayName}`,
      fields: [
        {name: '💵 Cash', value: `$${response.cash.toLocaleString()}`},
        {name: '🏦 Bank', value: `$${response.bank.toLocaleString()}`},
        {name: '📉 Debt', value: `$${response.debt.toLocaleString()}`},
      ],
    };
    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed], ephemeral: true});
  },
};
