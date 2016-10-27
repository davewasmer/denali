import dedent from 'dedent-js';
import { spawn } from 'child_process';
import ui from '../lib/cli/ui';
import Command from '../lib/cli/command';
import Project from '../lib/cli/project';
import assign from 'lodash/assign';

export default class TestCommand extends Command {

  static commandName = 'test';
  static description = "Run your app's test suite";
  static longDescription = dedent`
    Runs your app's test suite, and can optionally keep re-running it on each file
    change (--watch).`;

  runsInApp = true;

  params = [ 'files' ];

  flags = {
    debug: {
      description: 'Run the server in debug mode',
      defaultValue: false,
      type: Boolean
    },
    watch: {
      description: 'Re-run the tests when the source files change',
      defaultValue: false,
      type: Boolean
    },
    match: {
      description: 'Filter which tests run based on the supplied regex pattern',
      defaultValue: null,
      type: String
    },
    timeout: {
      description: 'Set the timeout for all tests, i.e. --timeout 10s, --timeout 2m',
      defaultValue: null,
      type: String
    },
    'skip-lint': {
      description: 'Skip linting the app source files',
      defaultValue: false,
      type: Boolean
    },
    'skip-audit': {
      description: 'Skip auditing your package.json for vulnerabilites',
      defaultValue: false,
      type: Boolean
    },
    verbose: {
      description: 'Print detailed output of the status of your test run',
      defaultValue: false,
      type: Boolean
    },
    output: {
      description: 'The directory to write the compiled app to. Defaults to a tmp directory',
      defaultValue: 'dist',
      type: String
    }
  };

  run({ params, flags }) {
    this.files = params.files || 'test/**/*.js';
    this.watch = flags.watch || flags.environment === 'development';
    this.port = flags.port;
    this.debug = flags.debug;
    this.match = flags.match;
    this.verbose = flags.verbose;
    this.timeout = flags.timeout;

    this.project = new Project({
      environment: 'test',
      audit: !flags['skip-audit'],
      lint: !flags['skip-lint']
    });

    process.on('exit', this.cleanExit.bind(this));
    process.on('SIGINT', this.cleanExit.bind(this));
    process.on('SIGTERM', this.cleanExit.bind(this));

    if (this.watch) {
      this.project.watch({
        outputDir: flags.output,
        onBuild: () => {
          if (this.tests) {
            this.tests.removeAllListeners('exit');
            this.tests.kill();
          }
          this.runTests(flags.output);
        }
      });
    } else {
      this.project.build(flags.output)
      .then(() => {
        this.runTests(flags.output);
      });
    }
  }

  cleanExit() {
    if (this.tests) {
      this.tests.kill();
    }
  }

  runTests(buildDir) {
    let args = [ this.files, '!test/dummy/**/*' ];
    if (this.match) {
      args.push('--match', this.match);
    }
    if (this.debug) {
      args.push('--inspect', '--debug-brk');
    }
    if (this.verbose) {
      args.push('--verbose');
    }
    if (this.timeout) {
      args.push('--timeout', this.timeout);
    }
    this.tests = spawn('./node_modules/.bin/ava', args, {
      cwd: buildDir,
      stdio: [ 'pipe', process.stdout, process.stderr ],
      env: assign({}, process.env, {
        PORT: this.port,
        DENALI_ENV: this.project.environment,
        NODE_ENV: this.project.environment
      })
    });
    this.tests.on('exit', (code) => {
      if (code === 0) {
        ui.success('Tests passed! (๑˃̵ᴗ˂̵)و');
      } else {
        ui.error('Tests failed! (▰˘︹˘▰)');
      }
      if (this.watch) {
        ui.info('Waiting for changes to re-run ...');
      } else {
        process.exit(code);
      }
    });
  }

}
