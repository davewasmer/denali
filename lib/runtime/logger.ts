import {
  identity,
  padStart
} from 'lodash';
import * as chalk from 'chalk';
import DenaliObject from '../metal/object';
import * as util from 'util';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * A simple Logger class that adds timestamps and supports multiple levels of logging, colorized
 * output, and control over verbosity.
 * https://developer.mozilla.org/en-US/docs/Web/API/Console/log
 * @package runtime
 * @since 0.1.0
 */
export default class Logger extends DenaliObject {

  /**
   * Default log level if none specified.
   *
   * @since 0.1.0
   */
  loglevel: LogLevel = 'info';

  /**
   * Specify if logs should be colorized.
   *
   * @since 0.1.0
   */
  colorize = true;

  /**
   * Available log levels that can be used.
   */
  levels: LogLevel[] = [
    'info',
    'warn',
    'error',
    'debug'
  ];

  /**
   * Color map for the available levels.
   */
  colors: { [level: string]: chalk.ChalkChain } = {
    info: chalk.white,
    debug: chalk.cyan,
    warn: chalk.yellow,
    error: chalk.red
  };

  /**
   * Log at the 'info' level.
   *
   * @since 0.1.0
   */
  info(...params: any[]): void {
    this.log('info', params);
  }

  /**
   * Log at the 'warn' level.
   *
   * @since 0.1.0
   */
  warn(...params: any[]): void {
    this.log('warn', params);
  }

  /**
   * Log at the 'error' level.
   *
   * @since 0.1.0
   */
  error(...params: any[]): void {
    this.log('error', params);
  }

  /**
   * Log at the 'debug' level.
   *
   * @since 0.2.0
   */
  debug(...params: any[]): void {
    this.log('debug', params);
  }

  /**
   * Log a message to the logger at a specific log level.
   */
  log(level: LogLevel, ...params: any[]): void {
    let message = this.formatMessage(level, params);

    if (level.toLowerCase() === 'error') {
      this.writeError(message);
    } else {
      this.write(message);
    }
  }

  protected formatMessage(level: LogLevel, ...params: any[]): string {
    let formattedMessage = util.format.apply(this, params);

    if (this.levels.indexOf(level) === -1) {
      level = this.loglevel;
    }

    let timestamp = (new Date()).toISOString();
    let padLength = this.levels.reduce((n: number, label) => Math.max(n, label.length), null);
    let levelLabel = padStart(level.toUpperCase(), padLength);

    if (this.colorize) {
      let colorizer = this.colors[level] || identity;
      formattedMessage = colorizer(formattedMessage);
      levelLabel = colorizer(levelLabel);
    }

    return `[${timestamp}] ${levelLabel} - ${formattedMessage}\n`;
  }

  protected write(message: string) {
    process.stdout.write(message);
  }

  protected writeError(message: string) {
    process.stderr.write(message);
  }
}
