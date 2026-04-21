const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const economyHandler = require('../../modules/economy/adminOperations/economyHandler');
const logger = require('../../utils/logger');
const {
  createBalanceEmbed,
  createConfirmationEmbed,
  createStatusEmbed,
  getDisplayName,
  formatCurrency,
} = require('../../utils/economyFeedback');
const {
  deferGuildInteraction,
  getOptionInteger,
  getOptionString,
  getOptionUser,
} = require('../../utils/interactionHelpers');
const { promptForConfirmation } = require('../../utils/confirmationFlow');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Manage player economy balances.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('get')
        .setDescription("Check a user's balances.")
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Target user')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set a user cash, bank, or debt balance.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Target user')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('field')
            .setDescription('Balance field to set')
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
            .setDescription('New balance amount')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('give')
        .setDescription('Adjust a user cash, bank, or debt balance.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Target user')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('field')
            .setDescription('Balance field to adjust')
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
            .setDescription('Adjustment amount')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription("Reset all of a user's economy values to zero.")
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Target user')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('airdrop')
        .setDescription(
          'Give every active member in the current channel the same cash amount.',
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to give each active member')
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 0,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description:
          'You need administrator permissions to execute this command.',
        title: '❌ Permission Denied',
        defer: true,
        deferOptions: { flags: MessageFlags.Ephemeral },
      }))
    ) {
      return;
    }

    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      const responseEmbed = createStatusEmbed({
        title: '❌ Permission Denied',
        description:
          'You need administrator permissions to execute this command.',
        color: '#FF0000',
      });
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand !== 'get') {
        const previewEmbed = createConfirmationEmbed(
          buildConfirmationPreview(interaction),
        );
        const confirmed = await promptForConfirmation(
          interaction,
          previewEmbed,
        );
        if (!confirmed) {
          return;
        }
      }

      const endOperation = commandMetrics?.step('economy operation');
      const response = await economyHandler(interaction);
      endOperation?.();

      if (!response.success) {
        logger.error(
          `Operation failed in command ${interaction.commandName}: ${response.error}`,
        );
        const endRender = commandMetrics?.step('response build');
        const responseEmbed = createStatusEmbed({
          title: '❌ Operation Failed',
          description: response.error,
          color: '#FF0000',
        });
        endRender?.();
        return interaction.editReply({
          embeds: [responseEmbed],
          components: [],
        });
      }

      switch (subcommand) {
        case 'get': {
          const user = getOptionUser(interaction, 'user', 'target_user');
          const endRender = commandMetrics?.step('response build');
          const responseEmbed = createBalanceEmbed({
            title: `💰 Financial Statement for ${getDisplayName(interaction, user)}`,
            cash: response.cash,
            bank: response.bank,
            debt: response.debt,
          });
          endRender?.();
          return interaction.editReply({
            embeds: [responseEmbed],
            components: [],
          });
        }
        case 'set': {
          const user = getOptionUser(interaction, 'user', 'target_user');
          const endRender = commandMetrics?.step('response build');
          const responseEmbed = createStatusEmbed({
            title: '✅ Balance Updated',
            description: `${getDisplayName(interaction, user)}'s ${response.field} balance was set to ${formatCurrency(response.newAmount)}.`,
            color: '#33CC33',
          });
          endRender?.();
          return interaction.editReply({
            embeds: [responseEmbed],
            components: [],
          });
        }
        case 'give': {
          const user = getOptionUser(interaction, 'user', 'target_user');
          const amount = getOptionInteger(interaction, 'amount', 'cash_amount');
          const endRender = commandMetrics?.step('response build');
          const responseEmbed = createStatusEmbed({
            title: '✅ Balance Adjusted',
            description:
              response.field === 'debt'
                ? `${getDisplayName(interaction, user)}'s debt was reduced by ${formatCurrency(amount)}. Remaining debt: ${formatCurrency(response.newAmount)}.`
                : `${getDisplayName(interaction, user)}'s ${response.field} balance increased by ${formatCurrency(amount)}. New balance: ${formatCurrency(response.newAmount)}.`,
            color: '#33CC33',
          });
          endRender?.();
          return interaction.editReply({
            embeds: [responseEmbed],
            components: [],
          });
        }
        case 'reset': {
          const user = getOptionUser(interaction, 'user', 'target_user');
          const endRender = commandMetrics?.step('response build');
          const responseEmbed = createStatusEmbed({
            title: '✅ Balance Reset',
            description: `${getDisplayName(interaction, user)}'s cash, bank, and debt were reset to zero.`,
            color: '#33CC33',
          });
          endRender?.();
          return interaction.editReply({
            embeds: [responseEmbed],
            components: [],
          });
        }
        case 'airdrop': {
          const amount = getOptionInteger(interaction, 'amount');
          const endRender = commandMetrics?.step('response build');
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
          endRender?.();
          return interaction.editReply({
            embeds: [responseEmbed],
            components: [],
          });
        }
        default: {
          const endRender = commandMetrics?.step('response build');
          const responseEmbed = createStatusEmbed({
            title: '❌ Operation Failed',
            description: 'Invalid economy subcommand.',
            color: '#FF0000',
          });
          endRender?.();
          return interaction.editReply({
            embeds: [responseEmbed],
            components: [],
          });
        }
      }
    } catch (error) {
      logger.error(
        `Error in command ${interaction.commandName} for user ${interaction.user.tag}: ${error.message}`,
      );
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '❌ Operation Failed',
        description: `Command ${interaction.commandName} failed. Please see logs for more information.`,
        color: '#FF0000',
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed], components: [] });
    }
  },
};

module.exports.buildConfirmationPreview = buildConfirmationPreview;

function buildConfirmationPreview(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const user = getOptionUser(interaction, 'user', 'target_user');
  const field = getOptionString(interaction, 'field');
  const amount = getOptionInteger(interaction, 'amount', 'cash_amount');
  const resolvedName = getDisplayName(interaction, user);

  switch (subcommand) {
    case 'set':
      return {
        title: '⚠️ Are you sure?',
        description: `This will set ${resolvedName}'s ${field} balance to ${formatCurrency(amount)}.`,
        fields: [
          { name: 'Target', value: resolvedName, inline: true },
          { name: 'Field', value: field, inline: true },
          { name: 'Amount', value: formatCurrency(amount), inline: true },
        ],
      };
    case 'give':
      return {
        title: '⚠️ Are you sure?',
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
        title: '⚠️ Are you sure?',
        description: `This will reset ${resolvedName}'s cash, bank, and debt to zero.`,
        fields: [
          { name: 'Target User', value: resolvedName, inline: false },
          { name: 'Affected Fields', value: 'cash, bank, debt', inline: false },
        ],
      };
    case 'airdrop': {
      const channelLabel = interaction.channel?.name
        ? `#${interaction.channel.name}`
        : 'the current channel';
      return {
        title: '⚠️ Are you sure?',
        description: `This will give ${formatCurrency(amount)} to every active member currently in ${channelLabel}.`,
        fields: [
          { name: 'Target Channel', value: channelLabel, inline: true },
          { name: 'Amount', value: formatCurrency(amount), inline: true },
        ],
      };
    }
    default:
      return {
        title: '⚠️ Are you sure?',
        description: 'This action will modify economy data.',
        fields: [],
      };
  }
}
