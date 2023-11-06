const {EmbedBuilder} = require('discord.js');
const {CronJob} = require('cron').CronJob;
const {Client} = require('discord.js');
const logger = require('../../utils/logger');

function createReminderEmbed(title, description) {
  const embed = new EmbedBuilder()
    .setTitle(`:reminder_ribbon: ${title}`)
    .setColor('#a8dadc')
    .setDescription(description);
  return embed;
}

/**
 *
 * @param {Client} client
 */
function cronJobs(client) {
  const beastInvasion1 = new CronJob(
    '59 11 * * *',
    async () => {
      try {
        const channel = await client.channels.cache.get('1159615863004078170');
        await channel.send({
          content: '<@1159618825646514266>',
          embeds: [beastInvasion],
        });
      } catch (error) {
        logger.error(`An error occurred in job beastInvasion1: ${error}`);
      }
    },
    null,
    true,
    'America/New_York'
  );

  const beastInvasion2 = new CronJob(
    '59 17 * * *',
    async () => {
      try {
        const channel = await client.channels.cache.get('1159615863004078170');
        await channel.send({
          content: '<@1159618825646514266>',
          embeds: [beastInvasion],
        });
      } catch (error) {
        logger.error(`An error occurred in job beastInvasion2: ${error}`);
      }
    },
    null,
    true,
    'America/New_York'
  );

  const worldApex1 = new CronJob(
    '59 14 * * 0',
    async () => {
      try {
        const channel = await client.channels.cache.get('1159615863004078170');
        channel.send({
          content: '<@1159618938905305198>',
          embeds: [worldApex],
        });
      } catch (error) {
        logger.error(`An error occurred in job worldApex1: ${error}`);
      }
    },
    null,
    true,
    'America/New_York'
  );

  const worldApex2 = new CronJob(
    '29 15 * * 0',
    async () => {
      try {
        const channel = await client.channels.cache.get('1159615863004078170');
        await channel.send({
          content: '<@1159618938905305198>',
          embeds: [worldApex],
        });
      } catch (error) {
        logger.error(`An error occurred in job worldApex2: ${error}`);
      }
    },
    null,
    true,
    'America/New_York'
  );

  const sectClash1 = new CronJob(
    '59 14 * * 0',
    async () => {
      try {
        const channel = await client.channels.cache.get('1159615863004078170');
        await channel.send({
          content: '<@1159618905258598520>',
          embeds: [sectClash],
        });
      } catch (error) {
        logger.error(`An error occurred in job sectClash1: ${error}`);
      }
    },
    null,
    true,
    'America/New_York'
  );

  const sectDuel1 = new CronJob(
    '59 14 * * 0',
    async () => {
      try {
        const channel = await client.channels.cache.get('1159615863004078170');
        await channel.send({
          content:
            '<@1171139195104923698> <@1144733018829889647> <@1152709357633536080>',
          embeds: [sectDuel],
        });
      } catch (error) {
        logger.error(`An error occurred in job sectDuel1: ${error}`);
      }
    },
    null,
    true,
    'America/New_York'
  );
}

module.exports = {cronJobs};

const beastInvasion = createReminderEmbed(
  'Beast Invasion',
  '🛡️ Beast Invasion starts in 1 minute.'
);

const worldApex = createReminderEmbed(
  'World Apex',
  '⚔️ World Apex starts in 1 minute.'
);

const sectClash = createReminderEmbed(
  'Sect Clash',
  '⚔️ Sect Clash starts in 1 minute.'
);

const sectDuel = createReminderEmbed(
  'Sect Duel',
  '⚔️ DUEL OR DIE! Complete your Sect Duel offense!'
);

const sectMeditation = createReminderEmbed(
  'Sect Duel',
  '☯️ Sect Meditation immediately after Beast Invasion. Be there or be square.'
);

const demonbendAbyss = createReminderEmbed(
  'Sect Duel',
  '☯️ Sect Meditation immediately after Beast Invasion. Be there or be square.'
);
