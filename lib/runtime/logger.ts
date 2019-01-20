import {
  identity,
  padStart
} from 'lodash';
import * as chalk from 'chalk';
import * as moment from 'moment';
import DenaliObject from '../metal/object';
import inject from '../metal/inject';
import ConfigService from './config';

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * A simple Logger class that adds timestamps and supports multiple levels of
 * logging, colorized output, and control over verbosity.
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Logger extends DenaliObject {
  config = inject<ConfigService>('service:config');

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
   * Specify if logs should be colorized.
   *
   * @since 0.1.3
   */
  timestamps = true;

  /**
   * Available log levels that can be used.
   */
  levels: LogLevel[] = [
    'info',
    'warn',
    'error'
  ];

  /**
   * Color map for the available levels.
   */
  colors: { [level: string]: (...text: string[]) => string } = {
    info: chalk.white,
    warn: chalk.yellow,
    error: chalk.red
  };

  /**
   * Log at the 'info' level.
   *
   * @since 0.1.0
   */
  info(msg: any): void {
    this.log('info', msg);
  }

  /**
   * Log at the 'warn' level.
   *
   * @since 0.1.0
   */
  warn(msg: any): void {
    this.log('warn', msg);
  }

  /**
   * Log at the 'error' level.
   *
   * @since 0.1.0
   */
  error(msg: any): void {
    this.log('error', msg);
  }

  /**
   * Log a message to the logger at a specific log level.
   */
  log(level: LogLevel, msg: string): void {
    if (this.levels.indexOf(level) === -1) {
      level = this.loglevel;
    }

    let padLength = this.levels.reduce((n: number, label) => Math.max(n, label.length), null);
    let levelLabel = padStart(level.toUpperCase(), padLength);
    if (this.colorize) {
      let colorizer = this.colors[level] || identity;
      msg = colorizer(msg);
      levelLabel = colorizer(levelLabel);
    }

    let parts: string[] = [];
    if (this.timestamps) {
      let timestamp;

      if (this.config.environment !== 'production') {
        // Prints Local time in ISO8601 format with fractional seconds.
        timestamp = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ');
      } else {
        // Prints UTC timestamp
        timestamp = moment().toISOString();
      }
      
      parts.push(`[${ timestamp }]`);
    }
    parts.push(levelLabel);
    parts.push(msg);
    
    /* tslint:enable:no-console no-debugger*/
    console.log(parts.join(' '));
    if (level === 'error') {	
      debugger;	
    }
    /* tslint:disable:no-console no-debugger */
  }

}
