const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  listBackgroundDefinitions,
} = require('../../storage/cultivationRepository');
const {
  createCultivatorForDiscordUserId,
} = require('../../modules/cultivation/flowService');
const {
  createDuplicateCharacterEmbed,
  createStartSuccessEmbed,
  formatBackgroundEffectSummary,
} = require('../../modules/cultivation/flowPresentation');
const { getOptionString } = require('../../utils/interactionHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Create your mortal.')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Your mortal name')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('background')
        .setDescription('Choose a background')
        .setAutocomplete(true)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('path')
        .setDescription('Choose a cultivation path')
        .setRequired(true)
        .addChoices(
          { name: 'Body', value: 'body' },
          { name: 'Spirit', value: 'qi' },
          { name: 'Balanced', value: 'balanced' },
        ),
    ),
  cooldown: 3,
  deployGlobal: true,

  async autocomplete(interaction) {
    const focusedValue = String(
      interaction.options.getFocused?.() ?? '',
    ).toLowerCase();
    const backgrounds = await listBackgroundDefinitions();
    const choices = backgrounds
      .filter((background) => {
        if (!focusedValue) {
          return true;
        }

        return (
          background.key.toLowerCase().includes(focusedValue) ||
          background.name.toLowerCase().includes(focusedValue) ||
          background.description.toLowerCase().includes(focusedValue)
        );
      })
      .slice(0, 25)
      .map((background) => ({
        name: `${background.name} - ${formatBackgroundEffectSummary(background)}`.slice(
          0,
          100,
        ),
        value: background.key,
      }));

    return interaction.respond(choices);
  },

  async execute(interaction) {
    const name = getOptionString(interaction, 'name');
    const backgroundKey = getOptionString(interaction, 'background');
    const path = getOptionString(interaction, 'path');

    const result = await createCultivatorForDiscordUserId(interaction.user.id, {
      name,
      backgroundKey,
      path,
    });

    if (!result) {
      const embed = createDuplicateCharacterEmbed();
      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = createStartSuccessEmbed(result);
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
