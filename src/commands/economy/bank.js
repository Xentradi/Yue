const { SlashCommandBuilder } = require('discord.js');
const bankService = require('../../modules/economy/bankService');
const {
  createStatusEmbed,
  getDisplayName,
} = require('../../utils/economyFeedback');
const { getOptionString } = require('../../utils/interactionHelpers');

function formatBankChoices(banks) {
  return banks.map((bank) => `• ${bank.name}`).join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('View or change your active bank.')
    .addStringOption((option) =>
      option
        .setName('bank')
        .setDescription('Bank to make active')
        .setAutocomplete(true)
        .setRequired(false),
    ),
  cooldown: 2,
  deployGlobal: true,

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused?.() ?? '';
    const choices = bankService
      .searchBanks(focusedValue)
      .slice(0, 25)
      .map((bank) => ({
        name: bank.name,
        value: bank.id,
      }));

    return interaction.respond(choices);
  },

  async execute(interaction, commandMetrics) {
    if (typeof interaction.deferReply === 'function') {
      await interaction.deferReply();
    }

    const selectedBankValue = getOptionString(interaction, 'bank');
    const endLookup = commandMetrics?.step('bank lookup');

    if (selectedBankValue) {
      const result = await bankService.setActiveBank(
        interaction.user.id,
        selectedBankValue,
      );
      endLookup?.();

      if (!result.success) {
        const endRender = commandMetrics?.step('response build');
        const embed = createStatusEmbed({
          title: '⚠️ Bank Update Failed',
          description:
            result.message ?? 'We could not update your active bank.',
          color: '#FF3333',
        });
        endRender?.();
        return interaction.editReply({ embeds: [embed] });
      }

      const endRender = commandMetrics?.step('response build');
      const displayName = getDisplayName(interaction, interaction.user);
      const embed = createStatusEmbed({
        title: '🏦 Active Bank Updated',
        description: `${displayName} now uses ${result.activeBank.name} as the active bank.`,
        fields: [
          {
            name: 'Active Bank',
            value: result.activeBank.name,
            inline: false,
          },
          {
            name: 'How It Works',
            value:
              '/deposit, /withdraw, and loan commands will use this bank by default.',
            inline: false,
          },
        ],
      });
      endRender?.();
      return interaction.editReply({ embeds: [embed] });
    }

    const bankState = await bankService.getActiveBank(interaction.user.id);
    endLookup?.();

    const endRender = commandMetrics?.step('response build');
    const displayName = getDisplayName(interaction, interaction.user);
    const embed = createStatusEmbed({
      title: '🏦 Active Bank',
      description: `${displayName}'s active bank is ${bankState.activeBank.name}.`,
      fields: [
        {
          name: 'Active Bank',
          value: bankState.activeBank.name,
          inline: false,
        },
        {
          name: 'Available Banks',
          value: formatBankChoices(bankService.listBanks()),
          inline: false,
        },
        {
          name: 'Usage',
          value:
            'Use `/bank bank:<name>` to change the active bank. Deposit, withdraw, and loan flows will use this selection by default.',
          inline: false,
        },
      ],
    });
    endRender?.();
    return interaction.editReply({ embeds: [embed] });
  },
};
