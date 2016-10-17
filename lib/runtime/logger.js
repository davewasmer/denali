import chalk from 'chalk';
import identity from 'lodash/identity';
import padStart from 'lodash/padStart';

/**
 * A simple Logger class that adds timestamps and supports multiple levels of
 * logging, colorized output, and control over verbosity.
 *
 * @class Logger
 * @static
 * @module denali
 * @submodule runtime
 */
export default class Logger {
  /**
   * Default log level if none specified.
   *
   * @property logLevel
   * @type {String}
   */
  loglevel = 'info';

  /**
   * Specify if logs should be colorized.
   *
   * @property colorize
   * @type {Boolean}
   */
  colorize = true;

  /**
   * Available log levels that can be used.
   *
   * @property levels
   * @type {Array}
   * @private
   */
  levels = [
    'debug',
    'info',
    'warn',
    'error'
  ];

  /**
   * Color map for the available levels.
   *
   * @property colors
   * @type {Object}
   * @private
   */
  colors = {
    debug: chalk.cyan,
    info: chalk.white,
    warn: chalk.yellow,
    error: chalk.red
  };

  /**
   * Log at the 'debug' level.
   *
   * @method debug
   * @param msg {String} Message to log to the logger
   */
  debug(msg) {
    this.log('debug', msg);
  }

  /**
   * Log at the 'info' level.
   *
   * @method info
   * @param msg {String} Message to log to the logger
   */
  info(msg) {
    this.log('info', msg);
  }

  /**
   * Log at the 'warn' level.
   *
   * @method warn
   * @param msg {String} Message to log to the logger
   */
  warn(msg) {
    this.log('warn', msg);
  }

  /**
   * Log at the 'error' level.
   *
   * @method error
   * @param msg {String} Message to log to the logger
   */
  error(msg) {
    this.log('error', msg);
  }

  /**
   * Log a message to the logger at a specific log level.
   *
   * @method log
   * @param level {String} Level to log at
   * @param msg {String} Message to log to the logger
   */
  log(level, msg) {
    if (!arguments.length === 1) {
      msg = level;
      level = this.logLevel;
    }
    if (!this.levels.includes(level)) {
      level = this.logLevel;
    }
    let timestamp = (new Date()).toISOString();
    let padLength = this.levels.reduce((n, label) => Math.max(n, label.length));
    let levelLabel = padStart(level.toUpperCase(), padLength);
    if (this.colorize) {
      let colorizer = this.colors[level] || identity;
      msg = colorizer(msg);
      levelLabel = colorizer(levelLabel);
    }
    /* eslint-disable no-console */
    console.log(`[${ timestamp }] ${ levelLabel } - ${ msg }`);
    /* eslint-enable no-console */
  }

}
