const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

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
    'blackjack',
    'coin',
    'daily',
    'deposit',
    'dice',
    'economy',
    'fish',
    'help',
    'leaderboard',
    'pay',
    'ping',
    'restocklake',
    'steal',
    'support',
    'syncroles',
    'user',
    'withdraw',
  ];

  assert.deepEqual([...client.commands.keys()].sort(), expectedNames);
  assert.equal(client.commands.has('leaderboards'), false);
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
