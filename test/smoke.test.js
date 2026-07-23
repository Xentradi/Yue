const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const helpCommand = require('../src/commands/utilities/help');

test('core entrypoints parse cleanly', () => {
  const files = [
    'src/main.js',
    'src/handlers/commandHandler.js',
    'src/handlers/eventHandler.js',
    'src/events/interactionCreate.js',
    'src/events/messageCreate.js',
    'src/events/ready.js',
    'src/modules/scheduledEvents/scheduledTasks.js',
  ];

  for (const file of files) {
    execFileSync(process.execPath, ['--check', path.join(repoRoot, file)], {
      stdio: 'pipe',
    });
  }
});

test('command modules export the expected surface', () => {
  const names = new Set();

  for (const file of walkJsFiles(path.join(repoRoot, 'src/commands'))) {
    const command = require(file);
    assert.ok(command.data, `Missing data export in ${file}`);
    assert.equal(
      typeof command.execute,
      'function',
      `Missing execute export in ${file}`,
    );
    assert.equal(
      names.has(command.data.name),
      false,
      `Duplicate command name detected: ${command.data.name}`,
    );
    names.add(command.data.name);
  }
});

test('command handler registers the current command surface', () => {
  const registerCommands = require(
    path.join(repoRoot, 'src/handlers/commandHandler'),
  );
  const client = {};

  registerCommands(client);

  const expectedNames = [
    'balance',
    'bank',
    'blackjack',
    'breakthrough',
    'coin',
    'cultivate',
    'cultivation',
    'cultivation-rate',
    'daily',
    'deposit',
    'dice',
    'economy',
    'fish',
    'help',
    'leaderboard',
    'loan',
    'meditate',
    'pay',
    'ping',
    'profile',
    'restocklake',
    'start',
    'steal',
    'support',
    'syncroles',
    'user',
    'withdraw',
  ];

  assert.deepEqual([...client.commands.keys()].sort(), expectedNames);
  assert.equal(client.commands.has('leaderboards'), false);
});

test('admin commands do not expose stale slash confirm options', () => {
  const economy = require(
    path.join(repoRoot, 'src/commands/admin/economy'),
  ).data.toJSON();
  const restockLake = require(
    path.join(repoRoot, 'src/commands/admin/restockLake'),
  ).data.toJSON();

  assert.equal(hasOptionNamed(economy, 'confirm'), false);
  assert.equal(hasOptionNamed(restockLake, 'confirm'), false);
});

test('help groups commands by product area and hides admin commands from non-admin users', async () => {
  let replyPayload;
  const interaction = {
    inGuild: () => true,
    member: {
      permissions: {
        has: () => false,
      },
    },
    reply: async (payload) => {
      replyPayload = payload;
    },
  };

  await helpCommand.execute(interaction);

  assert.ok(replyPayload);
  assert.deepEqual(
    replyPayload.embeds[0].data.fields.map((field) => field.name),
    ['Economy', 'Games', 'Cultivation', 'Utilities'],
  );
  assert.equal(
    replyPayload.embeds[0].data.fields.some((field) => field.name === 'Admin'),
    false,
  );
});

test('startup config defaults to enabling command deploys unless explicitly disabled', () => {
  const { isCommandDeployEnabled } = require('../src/utils/startupConfig');

  assert.equal(isCommandDeployEnabled(), true);
  assert.equal(isCommandDeployEnabled('1'), true);
  assert.equal(isCommandDeployEnabled('true'), true);
  assert.equal(isCommandDeployEnabled('0'), false);
  assert.equal(isCommandDeployEnabled('false'), false);
});

test('clan service exports a reusable boundary for future membership flows', () => {
  const clanService = require('../src/modules/clanService');

  assert.deepEqual(clanService.CLAN_ALIGNMENTS, ['righteous', 'demonic']);
  assert.deepEqual(clanService.CLAN_RECRUITMENT_MODES, ['open', 'closed']);

  const profile = clanService.buildClanProfile({
    id: 'clan-1',
    name: 'The First Clan',
    alignment: 'demonic',
    virtue: '12',
    recruitmentMode: 'open',
    memberCount: '5',
    treasury: '2500',
  });

  const membership = clanService.buildMembershipSummary({
    clanId: 'clan-1',
    clanName: 'The First Clan',
  });

  const context = clanService.buildClanContext(
    { id: 'clan-1', recruitmentMode: 'open' },
    { clanId: 'clan-1' },
  );

  const joinCheck = clanService.canJoinClan({}, { id: 'clan-1' });

  assert.equal(profile.alignment, 'demonic');
  assert.equal(profile.isOpenRecruitment, true);
  assert.equal(profile.memberCount, 5);
  assert.equal(profile.treasury, 2500);
  assert.equal(membership.hasClanMembership, true);
  assert.equal(membership.isWanderer, false);
  assert.equal(context.canAccessClanResources, true);
  assert.equal(joinCheck.allowed, true);
});

test('event modules export the expected surface', () => {
  for (const file of walkJsFiles(path.join(repoRoot, 'src/events'))) {
    const event = require(file);
    assert.equal(typeof event.name, 'string', `Missing name export in ${file}`);
    assert.equal(
      typeof event.execute,
      'function',
      `Missing execute export in ${file}`,
    );
  }
});

test('embed helper creates a basic embed shape', () => {
  const { createEmbed } = require(path.join(repoRoot, 'src/utils/embedUtils'));
  const embed = createEmbed({
    title: 'Smoke Test',
    description: 'This is a smoke test.',
    color: '#123456',
    fields: [{ name: 'Field', value: 'Value' }],
  });

  assert.equal(embed.data.title, 'Smoke Test');
  assert.equal(embed.data.description, 'This is a smoke test.');
  assert.equal(embed.data.color, 1193046);
  assert.equal(embed.data.fields.length, 1);
});

function walkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function hasOptionNamed(commandJson, optionName) {
  const options = commandJson?.options ?? [];

  for (const option of options) {
    if (option.name === optionName) {
      return true;
    }

    if (
      option.options &&
      hasOptionNamed({ options: option.options }, optionName)
    ) {
      return true;
    }
  }

  return false;
}
