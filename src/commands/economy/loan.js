const { SlashCommandBuilder } = require('discord.js');
const bankService = require('../../modules/economy/bankService');
const {
  createBalanceEmbed,
  createStatusEmbed,
  formatCurrency,
} = require('../../utils/economyFeedback');
const {
  deferGuildInteraction,
  getOptionInteger,
} = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loan')
    .setDescription('Borrow from or repay your active bank.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('quote')
        .setDescription('Get a loan quote from your active bank.')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to quote')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('take')
        .setDescription('Take a loan from your active bank.')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to borrow')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('repay')
        .setDescription('Repay debt at your active bank.')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('Amount to repay')
            .setRequired(true),
        ),
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction, commandMetrics) {
    if (
      !(await deferGuildInteraction(interaction, {
        description: 'Loan actions can only be made inside a server.',
        defer: true,
      }))
    ) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const amount = getOptionInteger(interaction, 'amount', 'cash_amount');

    if (!Number.isInteger(amount) || amount <= 0) {
      const endRender = commandMetrics?.step('response build');
      const responseEmbed = createStatusEmbed({
        title: '⚠️ Loan Request Failed',
        description: 'Please provide a positive integer amount.',
        color: '#FF3333',
      });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endUpdate = commandMetrics?.step('loan');
    const data =
      subcommand === 'repay'
        ? await bankService.repayLoan(
            interaction.user.id,
            interaction.guildId,
            amount,
          )
        : subcommand === 'quote'
          ? await bankService.getLoanQuote(
              interaction.user.id,
              interaction.guildId,
              amount,
            )
          : await bankService.takeLoan(
              interaction.user.id,
              interaction.guildId,
              amount,
            );
    endUpdate?.();

    if (data?.success) {
      const bankName = data.activeBank?.name ?? 'your active bank';
      const endRender = commandMetrics?.step('response build');
      const responseEmbed =
        subcommand === 'quote'
          ? createStatusEmbed({
              title: `📜 Loan Quote from ${bankName}`,
              description: `Estimated terms for ${formatCurrency(data.amount)} from ${bankName}.`,
              fields: [
                {
                  name: 'Credit Score',
                  value: `${data.bureauScore} (${data.creditBand})`,
                  inline: false,
                },
                {
                  name: 'Bank Adjustment',
                  value: `${data.bankModifier?.approvalBias >= 0 ? '+' : ''}${data.bankModifier?.approvalBias ?? 0} approval bias`,
                  inline: true,
                },
                {
                  name: 'Adjusted Approval',
                  value: `${data.approvalScore}`,
                  inline: true,
                },
                {
                  name: 'Interest Rate',
                  value: data.interestRateLabel,
                  inline: true,
                },
                {
                  name: 'Estimated Term',
                  value: `${data.estimatedTermMonths} month(s)`,
                  inline: true,
                },
                {
                  name: 'Collateral Guideline',
                  value: data.collateralLabel,
                  inline: false,
                },
                {
                  name: 'Maximum Borrow',
                  value: formatCurrency(data.maxBorrow),
                  inline: true,
                },
              ],
            })
          : createBalanceEmbed({
              title:
                subcommand === 'repay'
                  ? `💳 Loan Repayment Completed at ${bankName}`
                  : `🏦 Loan Approved by ${bankName}`,
              description:
                subcommand === 'repay'
                  ? `Repaid ${formatCurrency(data.repaidAmount)} to ${bankName}.`
                  : `Borrowed ${formatCurrency(data.loanAmount)} from ${bankName}.`,
              cash: data.newBalance ?? 0,
              bank: data.bank ?? 0,
              debt:
                subcommand === 'repay'
                  ? data.remainingDebt
                  : (data.newDebt ?? 0),
            });
      endRender?.();
      return interaction.editReply({ embeds: [responseEmbed] });
    }

    const endRender = commandMetrics?.step('response build');
    const responseEmbed = createStatusEmbed({
      title:
        subcommand === 'quote'
          ? '⚠️ Loan Quote Failed'
          : '⚠️ Loan Request Failed',
      description: data?.message ?? 'We could not complete the loan request.',
      color: '#FF3333',
    });
    endRender?.();
    return interaction.editReply({ embeds: [responseEmbed] });
  },
};
