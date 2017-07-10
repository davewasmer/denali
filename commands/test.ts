import {
  assign
} from 'lodash';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ui, Command, Project, unwrap } from 'denali-cli';

/**
 * Run your app's test suite
 *
 * @package commands
 */
export default class TestCommand extends Command {

  /* tslint:disable:completed-docs typedef */
  static commandName = 'test';
  static description = "Run your app's test suite";
  static longDescription = unwrap`
    Runs your app's test suite, and can optionally keep re-running it on each file change (--watch).
  `;

  static runsInApp = true;

  static params = '[files...]';

  static flags = {
    debug: {
      description: 'The test file you want to debug. Can only debug one file at a time.',
      type: <any>'string'
    },
    watch: {
      description: 'Re-run the tests when the source files change',
      default: false,
      type: <any>'boolean'
    },
    match: {
      description: 'Filter which tests run based on the supplied regex pattern',
      type: <any>'string'
    },
    timeout: {
      description: 'Set the timeout for all tests, i.e. --timeout 10s, --timeout 2m',
      type: <any>'string'
    },
    skipLint: {
      description: 'Skip linting the app source files',
      default: false,
      type: <any>'boolean'
    },
    skipAudit: {
      description: 'Skip auditing your package.json for vulnerabilites',
      default: false,
      type: <any>'boolean'
    },
    verbose: {
      description: 'Print detailed output of the status of your test run',
      default: process.env.CI,
      type: <any>'boolean'
    },
    output: {
      description: 'The directory to write the compiled app to. Defaults to a tmp directory',
      default: path.join('tmp', 'test'),
      type: <any>'string'
    },
    printSlowTrees: {
      description: 'Print out an analysis of the build process, showing the slowest nodes.',
      default: false,
      type: <any>'boolean'
    },
    failFast: {
      description: 'Stop tests on the first failure',
      default: false,
      type: <any>'boolean'
    },
    litter: {
      description: 'Do not clean up tmp directories created during testing (useful for debugging)',
      default: false,
      type: <any>'boolean'
    },
    serial: {
      description: 'Run tests serially',
      default: false,
      type: <any>'boolean'
    },
    concurrency: {
      description: 'How many test files should run concurrently?',
      default: 5,
      type: <any>'number'
    }
  };

  tests: ChildProcess;

  async run(argv: any) {
    let files = <string[]>argv.files;
    if (files.length === 0) {
      files.push('test/**/*.js');
    } else {
      // Swap common file extensions out with `.js` so ava will find the actual, built files This
      // doesn't cover every possible edge case, hence the `isValidJsPattern` below, but it should
      // cover the common use cases.
      files = files.map((pattern) => pattern.replace(/\.[A-z0-9]{1,4}$/, '.js'));
    }
    // Filter for .js files only
    files = files.filter((pattern: string) => {
      let isValidJsPattern = pattern.endsWith('*') || pattern.endsWith('.js');
      if (!isValidJsPattern) {
        ui.warn(unwrap`
          If you want to run specific test files, you must use the .js extension. You supplied
          ${ pattern }. Denali will build your test files before running them, so you need to use
          the compiled filename which ends in .js
        `);
      }
      return isValidJsPattern;
    });

    let project = new Project({
      environment: 'test',
      printSlowTrees: argv.printSlowTrees,
      audit: !argv.skipAudit,
      lint: !argv.skipLint,
      buildDummy: true
    });

    process.on('exit', this.cleanExit.bind(this));
    process.on('SIGINT', this.cleanExit.bind(this));
    process.on('SIGTERM', this.cleanExit.bind(this));

    if (argv.watch) {
      project.watch({
        outputDir: argv.output,
        // Don't let broccoli rebuild while tests are still running, or else
        // we'll be removing the test files while in progress leading to cryptic
        // errors.
        beforeRebuild: async () => {
          if (this.tests) {
            return new Promise<void>((resolve) => {
              this.tests.removeAllListeners('exit');
              this.tests.on('exit', () => {
                delete this.tests;
                resolve();
              });
              this.tests.kill();
              ui.info('\n\n===> Changes detected, cancelling in-progress tests ...\n\n');
            });
          }
        },
        onBuild: this.runTests.bind(this, files, project, argv)
      });
    } else {
      try {
        await project.build(argv.output);
        this.runTests(files, project, argv);
      } catch (error) {
        process.exitCode = 1;
      }
    }
  }

  protected cleanExit() {
    if (this.tests) {
      this.tests.kill();
    }
  }

  protected runTests(files: string[], project: Project, argv: any) {
    let avaPath = path.join(process.cwd(), 'node_modules', '.bin', 'ava');
    let args = files.concat([ '!test/dummy/**/*', '--concurrency', argv.concurrency ]);
    if (argv.debug) {
      avaPath = process.execPath;
      args = [ '--inspect', '--debug-brk', path.join(process.cwd(), 'node_modules', 'ava', 'profile.js'), argv.debug ];
    }
    if (argv.match) {
      args.push('--match', argv.match);
    }
    if (argv.verbose) {
      args.unshift('--verbose');
    }
    if (argv.timeout) {
      args.unshift('--timeout', argv.timeout);
    }
    if (argv.failFast) {
      args.unshift('--fail-fast');
    }
    if (argv.serial) {
      args.unshift('--serial');
    }
    this.tests = spawn(avaPath, args, {
      cwd: argv.output,
      stdio: [ 'pipe', process.stdout, process.stderr ],
      env: assign({}, process.env, {
        PORT: argv.port,
        DENALI_LEAVE_TMP: argv.litter,
        NODE_ENV: project.environment,
        DEBUG_COLORS: 1
      })
    });
    ui.info(`===> Running ${ project.pkg.name } tests ...`);
    this.tests.on('exit', (code: number | null) => {
      if (code === 0) {
        ui.success('\n===> Tests passed 👍');
      } else {
        ui.error('\n===> Tests failed 💥');
      }
      delete this.tests;
      if (argv.watch) {
        ui.info('===> Waiting for changes to re-run ...\n\n');
       } else {
         process.exitCode = code == null ? 1 : code;
         ui.info(`===> exiting with ${ process.exitCode }`);
         process.exit(process.exitCode);
       }
    });
  }
}
