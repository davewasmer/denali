import dedent from 'dedent-js';
import { spawn } from 'child_process';
import ui from '../lib/cli/ui';
import Command from '../lib/cli/command';
import Project from '../lib/cli/project';
import assign from 'lodash/assign';

export default class ServerCommand extends Command {

  static commandName = 'server';
  static description = 'Runs the denali server for local or production use.';
  static longDescription = dedent`
    Launches the Denali server running your application.

    In a development environment, the server does several things:

     * watches your local filesystem for changes and automatically restarts for you.
     * lint your code on build
     * run a security audit of your package.json on build (via nsp)

    In production, the above features are disabled by default, and instead:

     * the server will fork worker processes to maximize CPU core usage`;

  runsInApp = true;

  params = [];

  flags = {
    environment: {
      description: 'The environment to run as, i.e. `production` (defaults to $DENALI_ENV, $NODE_ENV, or development)',
      defaultValue: process.env.DENALI_ENV || process.env.NODE_ENV || 'development',
      type: String
    },
    debug: {
      description: 'Run in debug mode (add the --debug flag to node, launch node-inspector)',
      defaultValue: false,
      type: Boolean
    },
    watch: {
      description: 'Restart the server when the source files change (default: true in development)',
      defaultValue: null,
      type: Boolean
    },
    port: {
      description: 'The port the HTTP server should bind to (default: 3000)',
      defaultValue: 3000,
      type: Number
    },
    lint: {
      description: 'Lint the app source files (default: true in development)',
      defaultValue: null,
      type: Boolean
    },
    audit: {
      description: 'Auditing your package.json for vulnerabilites (default: true in development)',
      defaultValue: null,
      type: Boolean
    },
    output: {
      description: 'The directory to write the compiled app to. Defaults to a tmp directory',
      defaultValue: 'dist',
      type: String
    }
  }

  run({ flags }) {
    this.watch = flags.watch || flags.environment === 'development';
    this.port = flags.port;
    this.debug = flags.debug;

    this.project = new Project({
      environment: this.environment,
      audit: flags.audit || flags.environment === 'development',
      lint: flags.lint || flags.environment !== 'production'
    });

    if (flags.watch || flags.environment === 'development') {
      this.project.watch({
        outputDir: flags.output,
        onBuild: () => {
          if (this.server) {
            this.server.removeAllListeners('exit');
            this.server.kill();
          }
          this.startServer(flags.output);
        }
      });
    } else {
      this.project.build(flags.output)
      .then(() => {
        this.startServer(flags.output);
      });
    }
  }

  startServer(dir) {
    let args = [ 'app/index.js' ];
    if (this.debug) {
      args.unshift('--inspect', '--debug-brk');
    }
    this.server = spawn('node', args, {
      cwd: dir,
      stdio: [ 'pipe', process.stdout, process.stderr ],
      env: assign({}, process.env, {
        PORT: this.port,
        DENALI_ENV: this.project.environment,
        NODE_ENV: this.project.environment
      })
    });
    this.server.on('exit', (code) => {
      let result = code === 0 ? 'exited' : 'crashed';
      ui.error(`Server ${ result }. waiting for changes to restart ...`);
    });
    process.on('exit', () => {
      this.server.kill();
    });
  }

}
