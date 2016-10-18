import dedent from 'dedent-js';
import { spawn } from 'child_process';
import ui from '../cli/ui';
import Command from '../cli/command';
import Project from '../cli/project';
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
      defaultValue: null,
      type: Boolean
    },
    grep: {
      description: 'Filter which tests run based on the supplied regex pattern',
      defaultValue: null,
      type: String
    },
    skipLint: {
      description: 'Skip linting the app source files',
      defaultValue: false,
      type: Boolean
    },
    skipAudit: {
      description: 'Skip auditing your package.json for vulnerabilites',
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
    this.grep = flags.grep;

    this.project = new Project({
      environment: 'test',
      audit: !flags.skipAudit,
      lint: !flags.skipLint
    });

    if (flags.watch || flags.environment === 'development') {
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

  runTests(buildDir) {
    let args = [ this.files, '--colors' ];
    if (this.grep) {
      args.push('--grep', this.grep);
    }
    if (this.debug) {
      args.push('--inspect', '--debug-brk');
    }
    this.tests = spawn('./node_modules/.bin/mocha', args, {
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
      ui.info('Waiting for changes to re-run ...');
    });
    let cleanExit = () => {
      this.tests.kill();
      process.exit();
    };
    process.on('SIGINT', cleanExit);
    process.on('SIGTERM', cleanExit);
  }

}
