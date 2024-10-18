jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

jest.mock('winston-daily-rotate-file');
jest.mock('@logtail/node');
jest.mock('@logtail/winston');

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const {Logtail} = require('@logtail/node');
const {LogtailTransport} = require('@logtail/winston');

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should create a logger with the correct configuration', () => {
    require('../../utils/logger');

    expect(winston.createLogger).toHaveBeenCalledTimes(1);
    expect(winston.createLogger).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info',
      format: expect.any(Function),
      transports: expect.arrayContaining([
        expect.any(winston.transports.Console),
        expect.any(DailyRotateFile),
        expect.any(LogtailTransport),
      ]),
    }));
  });

  it('should use the correct format', () => {
    require('../../utils/logger');

    expect(winston.format.combine).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function)
    );
    expect(winston.format.timestamp).toHaveBeenCalledWith({
      format: 'YYYY-MM-DD HH:mm:ss',
    });
    expect(winston.format.printf).toHaveBeenCalled();
  });

  it('should configure DailyRotateFile transport correctly', () => {
    require('../../utils/logger');

    expect(DailyRotateFile).toHaveBeenCalledWith({
      filename: 'logs/yue-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '14d',
    });
  });

  it('should initialize Logtail with the correct token', () => {
    process.env.LOG_TOKEN = 'test-token';
    require('../../utils/logger');

    expect(Logtail).toHaveBeenCalledWith('test-token');
  });

  it('should export a logger object', () => {
    const logger = require('../../utils/logger');

    expect(logger).toBeDefined();
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
  });
});
