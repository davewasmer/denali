import chalk from 'chalk';

let loglevels = [
  'debug',
  'info',
  'success',
  'warn',
  'error',
  'silent'
];

let env = process.env.DENALI_ENV || process.env.NODE_ENV || 'development';

let defaultLevels = {
  development: 'debug',
  test: 'silent',
  production: 'info'
};

export default {
  loglevel: defaultLevels[env],
  raw(level, output) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf(level)) {
      process.stdout.write(output || '');
    }
  },
  /* eslint-disable no-console */
  debug(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('debug')) {
      msgs = msgs.map((msg) => chalk.cyan(msg));
      console.log(...msgs);
    }
  },
  info(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('info')) {
      console.log(...msgs);
    }
  },
  warn(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('warn')) {
      msgs = msgs.map((msg) => chalk.yellow(msg));
      console.warn(...msgs);
    }
  },
  error(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('error')) {
      msgs = msgs.map((msg) => chalk.red(msg));
      console.error(...msgs);
    }
  },
  success(...msgs) {
    if (loglevels.indexOf(this.loglevel) <= loglevels.indexOf('success')) {
      msgs = msgs.map((msg) => chalk.green(msg));
      console.error(...msgs);
    }
  }
  /* eslint-enable no-console */
};
