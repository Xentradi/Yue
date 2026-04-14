const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const logger = require('../../utils/logger');

function createReminderEmbed(title, description) {
  const embed = new EmbedBuilder()
    .setTitle(`:reminder_ribbon: ${title}`)
    .setColor('#a8dadc')
    .setDescription(description);
  return embed;
}

function cronJobs(client) {
  scheduleMessage('59 11 * * *', 'beastInvasion1', async () => {
    await sendReminder(client, {
      content: '<@1159618825646514266>',
      embeds: [beastInvasion],
    });
  });

  scheduleMessage('59 17 * * *', 'beastInvasion2', async () => {
    await sendReminder(client, {
      content: '<@1159618825646514266>',
      embeds: [beastInvasion],
    });
  });

  scheduleMessage('59 14 * * 0', 'worldApex1', async () => {
    await sendReminder(client, {
      content: '<@1159618938905305198>',
      embeds: [worldApex],
    });
  });

  scheduleMessage('29 15 * * 0', 'worldApex2', async () => {
    await sendReminder(client, {
      content: '<@1159618938905305198>',
      embeds: [worldApex],
    });
  });

  scheduleMessage('59 14 * * 0', 'sectClash1', async () => {
    await sendReminder(client, {
      content: '<@1159618905258598520>',
      embeds: [sectClash],
    });
  });

  scheduleMessage('59 14 * * 0', 'sectDuel1', async () => {
    await sendReminder(client, {
      content:
        '<@1171139195104923698> <@1144733018829889647> <@1152709357633536080>',
      embeds: [sectDuel],
    });
  });
}

module.exports = { cronJobs };

function scheduleMessage(expression, jobName, handler) {
  cron.schedule(
    expression,
    async () => {
      try {
        await handler();
      } catch (error) {
        logger.error(`An error occurred in job ${jobName}: ${error}`);
      }
    },
    { timezone: 'America/New_York' },
  );
}

async function sendReminder(client, payload) {
  const channel = await client.channels.fetch('1159615863004078170');
  if (!channel) {
    throw new Error('Reminder channel not found.');
  }

  await channel.send(payload);
}

const beastInvasion = createReminderEmbed(
  'Beast Invasion',
  '🛡️ Beast Invasion starts in 1 minute.',
);

const worldApex = createReminderEmbed(
  'World Apex',
  '⚔️ World Apex starts in 1 minute.',
);

const sectClash = createReminderEmbed(
  'Sect Clash',
  '⚔️ Sect Clash starts in 1 minute.',
);

const sectDuel = createReminderEmbed(
  'Sect Duel',
  '⚔️ DUEL OR DIE! Complete your Sect Duel offense!',
);
