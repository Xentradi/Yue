const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');
const flowService = require('../../modules/cultivation/flowService');
const {
  createActionLockEmbed,
  createMeditationEndEmbed,
  createMeditationStartEmbed,
  createMeditationTickEmbed,
  createOnboardingEmbed,
  createProfileEmbed,
} = require('../../modules/cultivation/flowPresentation');
const {
  listBackgroundDefinitions,
} = require('../../storage/cultivationRepository');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meditate')
    .setDescription('Start or stop meditation.')
    .addSubcommand((subcommand) =>
      subcommand.setName('start').setDescription('Begin a meditation session.'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stop')
        .setDescription('Stop an active meditation session.'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Check meditation state.'),
    ),
  cooldown: 2,
  deployGlobal: true,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'stop') {
      return await executeStop(interaction);
    }

    if (subcommand === 'status') {
      return await executeStatus(interaction);
    }

    return await executeStart(interaction);
  },
};

async function executeStatus(interaction) {
  const profile = await flowService.getCultivationStatusForDiscordUserId(
    interaction.user.id,
  );
  if (!profile) {
    const embed = createOnboardingEmbed(await listBackgroundDefinitions());
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    embeds: [createProfileEmbed(profile)],
    flags: MessageFlags.Ephemeral,
  });
}

async function executeStop(interaction) {
  const liveProfile = await flowService.stopActiveMeditationSession(
    interaction.user.id,
    'Meditation stopped.',
  );
  const profile =
    liveProfile ??
    (await flowService.stopMeditationForDiscordUserId(interaction.user.id));
  if (!profile) {
    const embed = createOnboardingEmbed(await listBackgroundDefinitions());
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    embeds: [createMeditationEndEmbed(profile, 'Meditation stopped.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function executeStart(interaction) {
  const currentProfile = await flowService.getCultivationStatusForDiscordUserId(
    interaction.user.id,
  );
  if (!currentProfile) {
    const embed = createOnboardingEmbed(await listBackgroundDefinitions());
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (currentProfile.cultivation?.meditationStartedAt) {
    return interaction.reply({
      embeds: [
        createActionLockEmbed(
          'Meditation Already Active',
          'You are already meditating. Use `/meditate stop` if you want to end the session.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  const profile = await flowService.startMeditationForDiscordUserId(
    interaction.user.id,
    {
      profile: currentProfile,
    },
  );
  if (!profile) {
    const embed = createOnboardingEmbed(await listBackgroundDefinitions());
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  const stopButton = new ButtonBuilder()
    .setCustomId('meditate-stop')
    .setLabel('Stop Meditation')
    .setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder().addComponents(stopButton);

  const replyMessage = await interaction.reply({
    embeds: [createMeditationStartEmbed(profile)],
    components: [row],
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  if (typeof replyMessage?.createMessageComponentCollector !== 'function') {
    const tickOutcome = flowService.calculateMeditationTickOutcome(profile, {
      insightMeter: 0,
    });
    const persisted = await flowService.persistCultivationOutcome(
      profile,
      tickOutcome,
      {
        meditationStartedAt: profile.cultivation.meditationStartedAt,
      },
    );
    return interaction.editReply({
      embeds: [createMeditationTickEmbed(persisted.profile, tickOutcome)],
      components: [],
    });
  }

  let stopped = false;
  let sessionProfile = profile;
  let insightMeter = 0;
  let interval = null;
  const collector = replyMessage.createMessageComponentCollector({
    filter: (componentInteraction) =>
      componentInteraction.user.id === interaction.user.id &&
      componentInteraction.customId === 'meditate-stop' &&
      componentInteraction.message.id === replyMessage.id,
    max: 1,
  });

  const endSession = async (summary) => {
    if (stopped) {
      return sessionProfile;
    }

    stopped = true;
    if (interval) {
      clearInterval(interval);
    }
    flowService.clearMeditationSession(interaction.user.id);
    collector.stop('stopped');
    const finalProfile = await flowService.stopMeditationForDiscordUserId(
      interaction.user.id,
      {
        profile: sessionProfile,
      },
    );
    await interaction.editReply({
      embeds: [
        createMeditationEndEmbed(
          finalProfile ?? sessionProfile,
          summary ?? 'Meditation stopped.',
        ),
      ],
      components: [],
    });
    return finalProfile ?? sessionProfile;
  };

  flowService.registerMeditationSession(interaction.user.id, endSession);

  interval = setInterval(async () => {
    if (stopped) {
      return;
    }

    const tickOutcome = flowService.calculateMeditationTickOutcome(
      sessionProfile,
      {
        insightMeter,
      },
    );
    sessionProfile = flowService.mergeCultivationProfile(sessionProfile, {
      stage: tickOutcome.stage,
      stageProgress: tickOutcome.stageProgress,
      cultivationBase: tickOutcome.cultivationBase,
      qiCurrent: tickOutcome.qiCurrent,
      lastProgressAt: tickOutcome.lastProgressAt,
    });
    insightMeter = tickOutcome.nextInsightMeter;

    if (tickOutcome.insightProc && typeof interaction.followUp === 'function') {
      await interaction.followUp({
        content: `Insight Burst: +${tickOutcome.insightProgressGain ?? 0} Cultivation.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.editReply({
      embeds: [createMeditationTickEmbed(sessionProfile, tickOutcome)],
      components: [row],
    });
  }, 5000);

  collector.on('collect', async (componentInteraction) => {
    await componentInteraction.deferUpdate();
    await endSession('Meditation stopped by the cultivator.');
  });

  collector.on('end', async (_collected, reason) => {
    if (stopped || reason === 'stopped') {
      return;
    }
  });
}
