const {SlashCommandBuilder, PermissionFlagsBits} = require('discord.js');
const {createEmbed} = require('../../utils/embedUtils');
const economyHandler = require('../../modules/economy/adminOperations/economyHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy administrator operations')
    .addSubcommand(subcommand =>
      subcommand
        .setName('get')
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
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply({ephemeral: true});

    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      const responseEmbed = createEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({embeds: [responseEmbed]});
    }

    const response = await economyHandler(interaction);

    const embedOptions = {};

    if (response.success) {
      switch (interaction.options.getSubcommand()) {
        case 'get':
          embedOptions.title = `💰 Financial Statement for ${
            interaction.options.getUser('user').displayName
          }`;
          embedOptions.fields = [
            {name: '💵 Cash', value: `$${response.cash.toLocaleString()}`},
            {name: '🏦 Bank', value: `$${response.bank.toLocaleString()}`},
            {name: '📉 Debt', value: `$${response.debt.toLocaleString()}`},
          ];
          break;

        case 'give':
          embedOptions.title = '✅ Give Operation Successful';
          embedOptions.description = `An amount of $${response.newAmount.toLocaleString()} has been added to ${
            interaction.options.getUser('user').displayName
          }'s ${response.field} balance.`;
          break;

        case 'set':
          embedOptions.title = '✅ Set Operation Successful';
          embedOptions.description = `${
            interaction.options.getUser('user').displayName
          }'s ${
            response.field
          } balance has been set to $${response.newAmount.toLocaleString()}.`;
          break;
        case 'reset':
          embedOptions.title = '✅ Operation Successful';
          embedOptions.description = `The operation was executed successfully for ${
            interaction.options.getUser('user').displayName
          }.`;
          break;

        case 'airdrop':
          embedOptions.title = '✅ Airdrop Successful';
          embedOptions.description = `A total of $${response.total.toLocaleString()} has been distributed among the active users.`;

          await interaction.followUp({
            content: `${
              interaction.user
            } distributed $${response.total.toLocaleString()} among everyone @here. Check your balance!`,
          });
          break;
      }
    } else {
      embedOptions.title = '❌ Operation Failed';
      embedOptions.description = response.error;
      embedOptions.color = '#FF0000';
    }

    const responseEmbed = createEmbed(embedOptions);
    interaction.editReply({embeds: [responseEmbed], ephemeral: true});
  },
};
