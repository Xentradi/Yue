require('dotenv').config();
const {createLogger, format, transports} = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const {Logtail} = require('@logtail/node');
const {LogtailTransport} = require('@logtail/winston');

const logtail = new Logtail(process.env.LOG_TOKEN);

const logger = createLogger({
  level: 'info', // Log only info and above, change to 'debug' or 'verbose' for more detailed logs
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: 'logs/yue-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '14d',
    }),
    new LogtailTransport(logtail),
  ],
});

module.exports = logger;
