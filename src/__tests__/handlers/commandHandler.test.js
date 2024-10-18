const fs = require('node:fs');
const path = require('node:path');
const {Collection} = require('discord.js');
const logger = require('../../utils/logger');
const commandHandler = require('../../handlers/commandHandler');

jest.mock('node:fs');
jest.mock('node:path');
jest.mock('discord.js', () => ({
  Collection: jest.fn(() => ({
    set: jest.fn(),
  })),
}));
jest.mock('../../utils/logger');

describe('Command Handler', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      commands: new Collection(),
      cooldowns: new Collection(),
    };

    // Mock file system
    fs.readdirSync.mockImplementation((path) => {
      if (path.includes('commands')) return ['category1', 'category2'];
      if (path.includes('category1')) return ['command1.js', 'command2.js'];
      if (path.includes('category2')) return ['command3.js'];
      return [];
    });

    // Mock path.join to return predictable paths
    path.join.mockImplementation((...args) => args.join('/'));
  });

  it('should load commands correctly', () => {
    const mockValidCommand = {
      data: {name: 'validCommand'},
      execute: jest.fn(),
    };
    const invalidCommand = {};

    jest.mock('commands/category1/command1.js', () => mockValidCommand, {virtual: true});
    jest.mock('commands/category1/command2.js', () => invalidCommand, {virtual: true});
    jest.mock('commands/category2/command3.js', () => mockValidCommand, {virtual: true});

    commandHandler(mockClient);

    expect(mockClient.commands.set).toHaveBeenCalledTimes(2);
    expect(mockClient.commands.set).toHaveBeenCalledWith('validCommand', mockValidCommand);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('should create Collections for commands and cooldowns', () => {
    commandHandler(mockClient);

    expect(Collection).toHaveBeenCalledTimes(2);
    expect(mockClient.commands).toBeInstanceOf(Collection);
    expect(mockClient.cooldowns).toBeInstanceOf(Collection);
  });

  it('should log a warning for invalid commands', () => {
    const invalidCommand = {};
    jest.mock('commands/category1/command1.js', () => invalidCommand, {virtual: true});

    commandHandler(mockClient);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('missing a required "data" or "execute" property'));
  });

  it('should handle empty command folders', () => {
    fs.readdirSync.mockImplementation((path) => {
      if (path.includes('commands')) return ['emptyCategory'];
      return [];
    });

    commandHandler(mockClient);

    expect(mockClient.commands.set).not.toHaveBeenCalled();
  });
});
