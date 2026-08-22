const { createLogger, format, transports } = require('winston');
const { NODE_ENV } = require('./env');

const logger = createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: NODE_ENV === 'production'
        ? format.json()
        : format.combine(format.colorize(), format.simple()),
    }),
  ],
});

module.exports = logger;
