const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createStatusEmbed } = require('./economyFeedback');

function createConfirmationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm-action-confirm')
      .setLabel('Yes, apply')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('confirm-action-cancel')
      .setLabel('No, cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function promptForConfirmation(interaction, previewEmbed, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30000;
  const confirmingTitle = options.confirmingTitle ?? '⏳ Applying Change';
  const confirmingDescription =
    options.confirmingDescription ?? 'Yes. Applying the change now.';
  const cancelledTitle = options.cancelledTitle ?? '🛑 Change Cancelled';
  const cancelledDescription =
    options.cancelledDescription ?? 'No changes were made.';
  const timeoutTitle = options.timeoutTitle ?? '⌛ Confirmation Timed Out';
  const timeoutDescription =
    options.timeoutDescription ??
    'The action was not applied because no confirmation was received.';

  const replyMessage = await interaction.editReply({
    embeds: [previewEmbed],
    components: [createConfirmationRow()],
  });

  if (typeof replyMessage?.createMessageComponentCollector !== 'function') {
    throw new Error(
      'Confirmation flow requires a message component collector.',
    );
  }

  return await new Promise((resolve) => {
    let settled = false;

    const settle = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    const collector = replyMessage.createMessageComponentCollector({
      filter: (componentInteraction) =>
        componentInteraction.user.id === interaction.user.id &&
        ['confirm-action-confirm', 'confirm-action-cancel'].includes(
          componentInteraction.customId,
        ),
      time: timeoutMs,
      max: 1,
    });

    collector.on('collect', async (componentInteraction) => {
      if (componentInteraction.customId === 'confirm-action-confirm') {
        await componentInteraction.update({
          embeds: [
            createStatusEmbed({
              title: confirmingTitle,
              description: confirmingDescription,
              color: '#33CC33',
            }),
          ],
          components: [],
        });
        collector.stop('confirmed');
        settle(true);
        return;
      }

      await componentInteraction.update({
        embeds: [
          createStatusEmbed({
            title: cancelledTitle,
            description: cancelledDescription,
            color: '#FF8C00',
          }),
        ],
        components: [],
      });
      collector.stop('cancelled');
      settle(false);
    });

    collector.on('end', async (_collected, reason) => {
      if (settled) {
        return;
      }

      if (reason === 'time') {
        await interaction.editReply({
          embeds: [
            createStatusEmbed({
              title: timeoutTitle,
              description: timeoutDescription,
              color: '#FF8C00',
            }),
          ],
          components: [],
        });
      }

      settle(false);
    });
  });
}

module.exports = {
  promptForConfirmation,
};
