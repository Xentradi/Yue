const {Events, Collection} = require('discord.js');
const {convertToSeconds} = require('../../utils/calculate');
const logger = require('../../utils/logger');
const interactionCreateHandler = require('../../events/interactionCreate');

jest.mock('../../utils/calculate', () => ({
  convertToSeconds: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe('InteractionCreate Event Handler', () => {
  let mockInteraction;
  let mockClient;
  let mockCommand;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCommand = {
      data: {name: 'testCommand'},
      execute: jest.fn(),
      cooldown: '5s',
    };

    mockClient = {
      commands: new Collection(),
      cooldowns: new Collection(),
    };

    mockInteraction = {
      isChatInputCommand: jest.fn(() => true),
      commandName: 'testCommand',
      client: mockClient,
      user: {id: 'testUserId', tag: 'testUser#1234'},
      guild: {id: 'testGuildId', name: 'Test Guild'},
      options: {_hoistedOptions: []},
      reply: jest.fn(),
      followUp: jest.fn(),
      deferred: false,
      replied: false,
    };

    mockClient.commands.set('testCommand', mockCommand);
  });

  it('should execute the command when valid', async () => {
    convertToSeconds.mockReturnValue(5);

    await interactionCreateHandler.execute(mockInteraction);

    expect(mockCommand.execute).toHaveBeenCalledWith(mockInteraction);
    expect(logger.info).toHaveBeenCalled();
  });

  it('should handle cooldowns correctly', async () => {
    convertToSeconds.mockReturnValue(5);

    // First execution
    await interactionCreateHandler.execute(mockInteraction);

    // Second execution (should be on cooldown)
    await interactionCreateHandler.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Please wait, you are on a cooldown'),
      ephemeral: true,
    }));
  });

  it('should log errors and reply with an error message', async () => {
    convertToSeconds.mockReturnValue(5);
    mockCommand.execute.mockRejectedValue(new Error('Test error'));

    await interactionCreateHandler.execute(mockInteraction);

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'There was an error while executing this command!',
      ephemeral: true,
    });
  });

  it('should not process non-chat input commands', async () => {
    mockInteraction.isChatInputCommand.mockReturnValue(false);

    await interactionCreateHandler.execute(mockInteraction);

    expect(mockCommand.execute).not.toHaveBeenCalled();
  });

  it('should handle commands that do not exist', async () => {
    mockInteraction.commandName = 'nonExistentCommand';

    await interactionCreateHandler.execute(mockInteraction);

    expect(logger.error).toHaveBeenCalledWith('No command matching nonExistentCommand was found.');
  });
});
