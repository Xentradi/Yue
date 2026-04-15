const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economyHandler = require('../../modules/economy/adminOperations/economyHandler');
const logger = require('../../utils/logger');
const {
  createBalanceEmbed,
  createConfirmationEmbed,
  createStatusEmbed,
  getDisplayName,
  formatCurrency,
} = require('../../utils/economyFeedback');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Manage player economy balances.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('get')
        .setDescription("Check a user's balances")
        .addUserOption((option) =>
          option.setName('user').setDescription('The user').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set the cash, bank, or debt of a user')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user').setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('field')
            .setDescription('Field to set')
            .setRequired(true)
            .addChoices(
              { name: 'cash', value: 'cash' },
              { name: 'bank', value: 'bank' },
              { name: 'debt', value: 'debt' },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to set')
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('confirm')
            .setDescription(
              'Confirm this destructive change before applying it',
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('give')
        .setDescription('Adjust cash, bank, or debt of a user')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user').setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('field')
            .setDescription('Field to adjust')
            .setRequired(true)
            .addChoices(
              { name: 'cash', value: 'cash' },
              { name: 'bank', value: 'bank' },
              { name: 'debt', value: 'debt' },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to give')
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('confirm')
            .setDescription(
              'Confirm this destructive change before applying it',
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription("Reset all of a user's economy values to 0")
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to reset')
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('confirm')
            .setDescription(
              'Confirm this destructive change before applying it',
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('airdrop')
        .setDescription(
          'Give everyone active in the current channel an entered amount of cash',
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to airdrop to each active user')
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName('confirm')
            .setDescription(
              'Confirm this destructive change before applying it',
            )
            .setRequired(false),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (
      !interaction.inGuild() ||
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const subcommand = interaction.options.getSubcommand();
    const confirm = interaction.options.getBoolean('confirm') ?? false;

    if (subcommand !== 'get' && !confirm) {
      const responseEmbed = createConfirmationEmbed(
        buildConfirmationPreview(interaction),
      );
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    try {
      const response = await economyHandler(interaction);

      if (!response.success) {
        logger.error(
          `Operation failed in command ${interaction.commandName}: ${response.error}`,
        );
        const responseEmbed = createStatusEmbed({
          title: '❌ Operation Failed',
          description: response.error,
          color: '#FF0000',
        });
        return interaction.editReply({ embeds: [responseEmbed] });
      }

      switch (subcommand) {
        case 'get': {
          const user = interaction.options.getUser('user');
          const responseEmbed = createBalanceEmbed({
            title: `💰 Financial Statement for ${getDisplayName(interaction, user)}`,
            cash: response.cash,
            bank: response.bank,
            debt: response.debt,
          });
          return interaction.editReply({ embeds: [responseEmbed] });
        }
        case 'set': {
          const user = interaction.options.getUser('user');
          const responseEmbed = createStatusEmbed({
            title: '✅ Balance Updated',
            description: `${getDisplayName(interaction, user)}'s ${response.field} balance was set to ${formatCurrency(response.newAmount)}.`,
            color: '#33CC33',
          });
          return interaction.editReply({ embeds: [responseEmbed] });
        }
        case 'give': {
          const user = interaction.options.getUser('user');
          const amount = interaction.options.getInteger('amount');
          const responseEmbed = createStatusEmbed({
            title: '✅ Balance Adjusted',
            description:
              response.field === 'debt'
                ? `${getDisplayName(interaction, user)}'s debt was reduced by ${formatCurrency(amount)}. Remaining debt: ${formatCurrency(response.newAmount)}.`
                : `${getDisplayName(interaction, user)}'s ${response.field} balance increased by ${formatCurrency(amount)}. New balance: ${formatCurrency(response.newAmount)}.`,
            color: '#33CC33',
          });
          return interaction.editReply({ embeds: [responseEmbed] });
        }
        case 'reset': {
          const user = interaction.options.getUser('user');
          const responseEmbed = createStatusEmbed({
            title: '✅ Balance Reset',
            description: `${getDisplayName(interaction, user)}'s cash, bank, and debt were reset to zero.`,
            color: '#33CC33',
          });
          return interaction.editReply({ embeds: [responseEmbed] });
        }
        case 'airdrop': {
          const amount = interaction.options.getInteger('amount');
          const responseEmbed = createStatusEmbed({
            title: '✅ Airdrop Successful',
            description: `Distributed ${formatCurrency(response.total)} across ${response.recipientCount} active users in the current channel.`,
            color: '#33CC33',
            fields: [
              { name: 'Per user', value: formatCurrency(amount), inline: true },
              {
                name: 'Recipients',
                value: `${response.recipientCount}`,
                inline: true,
              },
            ],
          });

          await interaction.followUp({
            content: `${interaction.user} distributed ${formatCurrency(response.total)} among active members in this channel. Check your balance!`,
          });
          return interaction.editReply({ embeds: [responseEmbed] });
        }
        default: {
          const responseEmbed = createStatusEmbed({
            title: '❌ Operation Failed',
            description: 'Invalid economy subcommand.',
            color: '#FF0000',
          });
          return interaction.editReply({ embeds: [responseEmbed] });
        }
      }
    } catch (error) {
      logger.error(
        `Error in command ${interaction.commandName} for user ${interaction.user.tag}: ${error.message}`,
      );
      const responseEmbed = createStatusEmbed({
        title: '❌ Operation Failed',
        description: `Command ${interaction.commandName} failed. Please see logs for more information.`,
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed] });
    }
  },
};

module.exports.buildConfirmationPreview = buildConfirmationPreview;

function buildConfirmationPreview(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.options.getUser('user');
  const field = interaction.options.getString('field');
  const amount = interaction.options.getInteger('amount');
  const resolvedName = getDisplayName(interaction, user);

  switch (subcommand) {
    case 'set':
      return {
        title: '⚠️ Confirm Balance Set',
        description: `This will set ${resolvedName}'s ${field} balance to ${formatCurrency(amount)}.`,
        fields: [
          { name: 'Target', value: resolvedName, inline: true },
          { name: 'Field', value: field, inline: true },
          { name: 'Amount', value: formatCurrency(amount), inline: true },
        ],
      };
    case 'give':
      return {
        title: '⚠️ Confirm Balance Adjustment',
        description:
          field === 'debt'
            ? `This will reduce ${resolvedName}'s debt by ${formatCurrency(amount)}.`
            : `This will add ${formatCurrency(amount)} to ${resolvedName}'s ${field} balance.`,
        fields: [
          { name: 'Target', value: resolvedName, inline: true },
          { name: 'Field', value: field, inline: true },
          { name: 'Amount', value: formatCurrency(amount), inline: true },
        ],
      };
    case 'reset':
      return {
        title: '⚠️ Confirm Economy Reset',
        description: `This will reset ${resolvedName}'s cash, bank, and debt to zero.`,
        fields: [{ name: 'Target', value: resolvedName, inline: false }],
      };
    case 'airdrop':
      return {
        title: '⚠️ Confirm Airdrop',
        description: `This will give ${formatCurrency(amount)} to every active member currently in the channel.`,
        fields: [
          { name: 'Amount', value: formatCurrency(amount), inline: true },
        ],
      };
    default:
      return {
        title: '⚠️ Confirm Change',
        description: 'This action will modify economy data.',
      };
  }
}
